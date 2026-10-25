-- One transactionally synchronized record format preserves existing string IDs
-- and lets the offline client migrate without rewriting every screen.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  avatar text not null default '🧑‍🎓' check (length(avatar) <= 100),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select, insert, update, delete on public.profiles to authenticated;

create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 80)) on conflict do nothing;
  return new;
end; $$;
create trigger create_user_profile after insert on auth.users for each row execute function public.create_profile();
revoke all on function public.create_profile() from public;

create table public.catalog_keys (kind text not null, id text not null, language text not null default 'de', primary key(kind,id));
alter table public.catalog_keys enable row level security;
create policy catalog_read on public.catalog_keys for select to authenticated using (true);
grant select on public.catalog_keys to authenticated;
create sequence public.sync_revision;
create table public.sync_record_data (
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('words','decks','texts','videos','reviews','statistics','recent','drafts','collections','solutions','testResults','preferences','activity')),
  record_id text not null check (length(record_id) between 1 and 512),
  data jsonb,
  revision bigint not null default nextval('public.sync_revision'),
  deleted boolean not null default false,
  primary key (owner_id, kind, record_id),
  check ((deleted and data is null) or (not deleted and jsonb_typeof(data) = 'object'))
);
create index sync_records_cursor on public.sync_record_data(owner_id, revision);
alter table public.sync_record_data enable row level security;
create policy own_records_read on public.sync_record_data for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.sync_record_data to authenticated;
-- All writes go through apply_sync_batch, including ownership/reference checks.
revoke insert, update, delete on public.sync_record_data from anon, authenticated;

-- Physical separation of card content from personal progress seeds.
create table public.card_progress (
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'words' check(kind='words'),
  id text not null,
  baseline jsonb not null default '{}',
  manual_progress jsonb,
  primary key(owner_id,id),
  foreign key(owner_id,kind,id) references public.sync_record_data(owner_id,kind,record_id) on delete cascade
);
alter table public.card_progress enable row level security;
create policy own_card_progress on public.card_progress for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.card_progress from anon,authenticated;
grant select on public.card_progress to authenticated;
create view public.sync_records with (security_invoker=true) as
 select r.owner_id,r.kind,r.record_id,
 case when r.kind='words' and not r.deleted then r.data || coalesce(p.baseline,'{}'::jsonb) || case when p.manual_progress is null then '{}'::jsonb else jsonb_build_object('manualProgress',p.manual_progress) end else r.data end as data,
 r.revision,r.deleted
 from public.sync_record_data r left join public.card_progress p on r.owner_id=p.owner_id and r.kind='words' and r.record_id=p.id;
grant select on public.sync_records to authenticated,service_role;
revoke insert,update,delete on public.sync_records from anon,authenticated;

create table public.sync_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  primary key(owner_id, operation_id)
);
alter table public.sync_receipts enable row level security;
revoke all on public.sync_receipts from anon, authenticated;

-- Durable maintenance lock: an interrupted cleanup stays locked until an
-- operator verifies that the worker has stopped and releases its token.
create table public.image_cleanup_locks (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  started_at timestamptz not null default now()
);
alter table public.image_cleanup_locks enable row level security;
revoke all on public.image_cleanup_locks from anon, authenticated;
grant select on public.image_cleanup_locks to authenticated;
create policy own_cleanup_lock on public.image_cleanup_locks for select to authenticated using(owner_id=(select auth.uid()));
create function public.begin_image_cleanup(target_owner uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text,0));
  insert into public.image_cleanup_locks(owner_id) values(target_owner) returning token into result;
  return result;
end; $$;
create function public.finish_image_cleanup(target_owner uuid, cleanup_token uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text,0));
  delete from public.image_cleanup_locks where owner_id=target_owner and token=cleanup_token;
end; $$;
revoke all on function public.begin_image_cleanup(uuid) from public,anon,authenticated;
revoke all on function public.finish_image_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_image_cleanup(uuid) to service_role;
grant execute on function public.finish_image_cleanup(uuid,uuid) to service_role;

create function public.apply_sync_batch(operation_id uuid, changes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); c jsonb; current_row public.sync_records; field text;
  previous jsonb; proposed jsonb; merged jsonb; conflicts jsonb := '[]';
  changed jsonb := '[]'; ref text; row_data record; ref_kind text; progress_data jsonb; content_data jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) not between 1 and 100000 or octet_length(changes::text) > 20000000 then
    raise exception 'Invalid batch';
  end if;
  -- Serializing per owner makes change cursors follow commit order, even when
  -- two devices submit concurrently. Do not permit direct writes around this lock.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  if exists(select 1 from public.image_cleanup_locks where owner_id=actor) then raise exception 'Image cleanup in progress'; end if;
  if exists(select 1 from public.sync_receipts r where r.owner_id = actor and r.operation_id = apply_sync_batch.operation_id) then
    return jsonb_build_object('ok', true, 'records', coalesce((select jsonb_agg(to_jsonb(sr)) from public.sync_records sr where sr.owner_id=actor and exists(select 1 from public.sync_receipts r, jsonb_array_elements(r.keys) k where r.owner_id=actor and r.operation_id=apply_sync_batch.operation_id and k->>'kind'=sr.kind and k->>'record_id'=sr.record_id)), '[]'::jsonb));
  end if;
  -- Validate the entire transaction before changing a single record.
  for c in select value from jsonb_array_elements(changes) loop
    if c->>'table' not in ('words','decks','texts','videos','reviews','statistics','recent','drafts','collections','solutions','testResults','preferences','activity')
      or coalesce(length(c->>'key'),0) not between 1 and 512 then raise exception 'Invalid record'; end if;
    previous := nullif(c->'before', 'null'::jsonb); proposed := nullif(c->'value', 'null'::jsonb);
    if proposed is not null and jsonb_typeof(proposed) <> 'object' then raise exception 'Invalid value'; end if;
    if proposed is not null and (case when c->>'table'='recent' then proposed->>'key' when c->>'table'='statistics' then proposed->>'date' else proposed->>'id' end) is distinct from c->>'key' then raise exception 'Record key mismatch'; end if;
    select * into current_row from public.sync_records where owner_id = actor and kind = c->>'table' and record_id = c->>'key';
    if found then
      if current_row.deleted then
        if proposed is not null and coalesce(c->>'restore','false') <> 'true' then conflicts := conflicts || jsonb_build_array(to_jsonb(current_row)); end if;
      elsif proposed is null then
        if not current_row.deleted and (case when c->>'table'='words' then current_row.data - array['interval','difficulty','status','nextReviewAt','reviewCount','correctCount','incorrectCount','lastReviewedAt','updatedAt'] else current_row.data - 'updatedAt' end) is distinct from (case when c->>'table'='words' then previous - array['interval','difficulty','status','nextReviewAt','reviewCount','correctCount','incorrectCount','lastReviewedAt','updatedAt'] else previous - 'updatedAt' end) then conflicts := conflicts || jsonb_build_array(to_jsonb(current_row)); end if;
      elsif c->>'table' in ('reviews', 'activity') then
        if current_row.data is distinct from proposed then conflicts := conflicts || jsonb_build_array(to_jsonb(current_row)); end if;
      elsif previous is null then
        if current_row.data is distinct from proposed then conflicts := conflicts || jsonb_build_array(to_jsonb(current_row)); end if;
      else
        for field in select jsonb_object_keys(previous || proposed) loop
          if field='updatedAt' or (c->>'table'='words' and field=any(array['interval','difficulty','status','nextReviewAt','reviewCount','correctCount','incorrectCount','lastReviewedAt'])) then continue; end if;
          if (previous->field) is distinct from (proposed->field)
            and (current_row.data->field) is distinct from (previous->field)
            and (current_row.data->field) is distinct from (proposed->field) then
            conflicts := conflicts || jsonb_build_array(to_jsonb(current_row)); exit;
          end if;
        end loop;
      end if;
    end if;
  end loop;
  if jsonb_array_length(conflicts) > 0 then return jsonb_build_object('ok', false, 'conflicts', conflicts); end if;
  for c in select value from jsonb_array_elements(changes) loop
    previous := nullif(c->'before','null'::jsonb); proposed := nullif(c->'value','null'::jsonb);
    select * into current_row from public.sync_records where owner_id = actor and kind = c->>'table' and record_id = c->>'key';
    merged := proposed;
    if found and not current_row.deleted and proposed is not null and previous is not null then
      merged := current_row.data;
      for field in select jsonb_object_keys(previous || proposed) loop
        if c->>'table'='words' and coalesce(c->>'resetProgress','false')<>'true' and field=any(array['interval','difficulty','status','nextReviewAt','reviewCount','correctCount','incorrectCount','lastReviewedAt']) then continue; end if;
        if (previous->field) is distinct from (proposed->field) then
          merged := merged - field;
          if proposed ? field then merged := merged || jsonb_build_object(field, proposed->field); end if;
        end if;
      end loop;
    end if;
    content_data := merged;
    if c->>'table'='words' and merged is not null then
      select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into progress_data from jsonb_each(merged) where key=any(array['interval','difficulty','status','nextReviewAt','reviewCount','correctCount','incorrectCount','lastReviewedAt','favorite']);
      content_data := merged - array['interval','difficulty','status','nextReviewAt','reviewCount','correctCount','incorrectCount','lastReviewedAt','favorite','manualProgress'];
    end if;
    insert into public.sync_record_data(owner_id,kind,record_id,data,deleted)
      values(actor,c->>'table',c->>'key',content_data,merged is null)
      on conflict(owner_id,kind,record_id) do update set data = excluded.data, deleted = excluded.deleted, revision = nextval('public.sync_revision');
    if c->>'table'='words' then
      if merged is null then delete from public.card_progress where owner_id=actor and id=c->>'key';
      else insert into public.card_progress(owner_id,id,baseline,manual_progress) values(actor,c->>'key',progress_data,merged->'manualProgress')
        on conflict(owner_id,id) do update set baseline=excluded.baseline,manual_progress=excluded.manual_progress;
      end if;
    end if;
    select * into current_row from public.sync_records where owner_id=actor and kind=c->>'table' and record_id=c->>'key';
    changed := changed || jsonb_build_array(to_jsonb(current_row));
  end loop;
  -- Resolve references within this owner's namespace only. Catalog references
  -- use stable IDs and are resolved by the versioned, static client catalog.
  for row_data in
    select sr.kind,sr.data from public.sync_records sr
      join jsonb_array_elements(changes) c on sr.kind=c.value->>'table' and sr.record_id=c.value->>'key'
      where sr.owner_id=actor and not sr.deleted and sr.kind in ('decks','collections','reviews')
    union
    select sr.kind,sr.data from public.sync_records sr where sr.owner_id=actor and not sr.deleted and sr.kind='decks'
      and exists(select 1 from jsonb_array_elements(changes) c where c.value->>'table'='words' and sr.data->'wordIds' ? (c.value->>'key'))
    union
    select sr.kind,sr.data from public.sync_records sr where sr.owner_id=actor and not sr.deleted and sr.kind='collections'
      and exists(select 1 from jsonb_array_elements(changes) c where c.value->>'table'='decks' and sr.data->'deckIds' ? (c.value->>'key'))
  loop
    ref_kind := case when row_data.kind='decks' or row_data.kind='reviews' then 'words' else 'decks' end;
    for ref in select jsonb_array_elements_text(case when row_data.kind='reviews' then jsonb_build_array(row_data.data->>'wordId') else coalesce(row_data.data->case when row_data.kind='decks' then 'wordIds' else 'deckIds' end, '[]'::jsonb) end) loop
      if ref is null or (not exists(select 1 from public.catalog_keys where kind=ref_kind and id=ref) and not exists(select 1 from public.sync_records where owner_id=actor and kind=ref_kind and record_id=ref and not deleted) and not (row_data.kind='reviews' and row_data.data->'baseline'->>'id'=ref)) then
        raise exception 'Missing or inaccessible reference';
      end if;
      if row_data.kind='decks' and row_data.data ? 'language' and (row_data.data->>'language') is distinct from coalesce(
        (select data->>'language' from public.sync_records where owner_id=actor and kind='words' and record_id=ref and not deleted),
        (select language from public.catalog_keys where kind='words' and id=ref)
      ) then raise exception 'Deck and card languages differ'; end if;
    end loop;
  end loop;
  insert into public.sync_receipts(owner_id, operation_id,keys) values(actor, apply_sync_batch.operation_id,(select jsonb_agg(jsonb_build_object('kind',value->>'kind','record_id',value->>'record_id')) from jsonb_array_elements(changed)));
  return jsonb_build_object('ok',true,'records',changed);
end; $$;
revoke all on function public.apply_sync_batch(uuid,jsonb) from public, anon;
grant execute on function public.apply_sync_batch(uuid,jsonb) to authenticated;

-- Convenient domain projections; the source protocol retains exact old IDs.
create view public.cards with (security_invoker=true) as select owner_id, record_id as id, data - array['interval','difficulty','status','nextReviewAt','reviewCount','correctCount','incorrectCount','lastReviewedAt','manualProgress','favorite'] as content from public.sync_records where kind='words' and not deleted;

create view public.review_events with (security_invoker=true) as select owner_id, record_id as id, data from public.sync_records where kind='reviews' and not deleted;
create view public.activity_events with (security_invoker=true) as select owner_id, record_id as id, data from public.sync_records where kind='activity' and not deleted;
grant select on public.cards, public.card_progress, public.review_events, public.activity_events to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('card-images','card-images',false,3145728,array['image/png','image/jpeg','image/webp','image/gif']) on conflict(id) do nothing;
create policy own_images_read on storage.objects for select to authenticated using (bucket_id='card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy own_images_insert on storage.objects for insert to authenticated with check (exists(select 1 from public.profiles where id=(select auth.uid())) and bucket_id='card-images' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists(select 1 from public.image_cleanup_locks where owner_id=(select auth.uid())));
create policy own_images_delete on storage.objects for delete to authenticated using (bucket_id='card-images' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists(select 1 from public.image_cleanup_locks where owner_id=(select auth.uid())));

-- Large imports are uploaded in resumable parts, but become visible atomically.
create table public.sync_staging (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  part_no integer not null check (part_no >= 0),
  total_parts integer not null check (total_parts between 1 and 1000),
  changes jsonb not null check (jsonb_typeof(changes)='array'),
  created_at timestamptz not null default now(),
  primary key(owner_id, operation_id, part_no)
);
alter table public.sync_staging enable row level security;
revoke all on public.sync_staging from anon, authenticated;
create function public.stage_sync_batch(operation_id uuid, part_no integer, total_parts integer, changes jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); combined jsonb; result jsonb; old_part public.sync_staging;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if part_no < 0 or part_no >= total_parts or total_parts not between 1 and 1000 or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 100 or octet_length(changes::text)>20000000 then raise exception 'Invalid part'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  if exists(select 1 from public.image_cleanup_locks where owner_id=actor) then raise exception 'Image cleanup in progress'; end if;
  if exists(select 1 from public.sync_receipts r where r.owner_id=actor and r.operation_id=stage_sync_batch.operation_id) then
    return public.apply_sync_batch(operation_id,changes);
  end if;
  select * into old_part from public.sync_staging s where s.owner_id=actor and s.operation_id=stage_sync_batch.operation_id and s.part_no=stage_sync_batch.part_no;
  if found and (old_part.changes is distinct from changes or old_part.total_parts<>total_parts) then raise exception 'Part changed during retry'; end if;
  if exists(select 1 from public.sync_staging s where s.owner_id=actor and s.operation_id=stage_sync_batch.operation_id and s.total_parts<>stage_sync_batch.total_parts) then raise exception 'Part count changed'; end if;
  insert into public.sync_staging(owner_id,operation_id,part_no,total_parts,changes) values(actor,operation_id,part_no,total_parts,changes) on conflict do nothing;
  if (select count(*) from public.sync_staging s where s.owner_id=actor and s.operation_id=stage_sync_batch.operation_id) < total_parts then return jsonb_build_object('ok',true,'staged',true); end if;
  select jsonb_agg(c.value order by s.part_no,c.ordinality) into combined from public.sync_staging s cross join lateral jsonb_array_elements(s.changes) with ordinality c where s.owner_id=actor and s.operation_id=stage_sync_batch.operation_id;
  result := public.apply_sync_batch(operation_id,combined);
  if (result->>'ok')::boolean then delete from public.sync_staging s where s.owner_id=actor and s.operation_id=stage_sync_batch.operation_id; end if;
  return result;
end; $$;
revoke all on function public.stage_sync_batch(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.stage_sync_batch(uuid,integer,integer,jsonb) to authenticated;

-- Server functions read through the security-invoker sync view and inspect
-- staged imports during image cleanup. Do not rely on automatic default grants.
grant select on public.sync_record_data, public.card_progress, public.sync_staging to service_role;
