-- Parameterized GIN probes replace scans of all memberships for every changed card.
create index if not exists sync_deck_memberships on public.sync_record_data using gin ((data->'wordIds')) where kind='decks' and not deleted;
create index if not exists sync_collection_memberships on public.sync_record_data using gin ((data->'deckIds')) where kind='collections' and not deleted;
create index if not exists sync_staging_age on public.sync_staging(created_at);
create index if not exists pending_account_deletions on public.account_deletion_jobs(requested_at) where status='pending';

-- Preserve older protocol records, but reject malformed fields before they reach another device.
create function public.validate_sync_value(kind text, value jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare field text; item jsonb;
begin
  if jsonb_typeof(value) <> 'object' then raise exception 'Invalid value' using errcode='22023'; end if;
  foreach field in array array['tags','wordIds','deckIds','acceptedTerms','acceptedTranslations'] loop
    if value ? field then
      if jsonb_typeof(value->field) <> 'array' then raise exception 'Invalid array: %',field using errcode='22023'; end if;
      for item in select jsonb_array_elements(value->field) loop
        if jsonb_typeof(item) <> 'string' then raise exception 'Invalid array item: %',field using errcode='22023'; end if;
      end loop;
    end if;
  end loop;
  foreach field in array array['term','translation','title','description','language','nativeLanguage','content','wordId','kind'] loop
    if value ? field and jsonb_typeof(value->field) <> 'string' then raise exception 'Invalid text: %',field using errcode='22023'; end if;
  end loop;
  foreach field in array array['favorite','separable','reflexive','bold','italic','underline','highlight'] loop
    if value ? field and jsonb_typeof(value->field) <> 'boolean' then raise exception 'Invalid boolean: %',field using errcode='22023'; end if;
  end loop;
  foreach field in array array['timestamp','createdAt','updatedAt','responseTime','reviewCount','correctCount','incorrectCount','nextReviewAt','interval','difficulty','lastPosition','readingProgress'] loop
    if value ? field and (jsonb_typeof(value->field) <> 'number' or (value->>field)::numeric < 0) then raise exception 'Invalid number: %',field using errcode='22023'; end if;
  end loop;
  if kind='words' and value ? 'status' and value->>'status' not in ('new','learning','review','mastered','ignored') then raise exception 'Invalid card status' using errcode='22023'; end if;
  if kind='reviews' and value ? 'result' and value->>'result' not in ('again','hard','good','easy') then raise exception 'Invalid review rating' using errcode='22023'; end if;
end; $$;
revoke all on function public.validate_sync_value(text,jsonb) from public,anon,authenticated;

create or replace function public.apply_sync_batch(operation_id uuid, changes jsonb) returns jsonb
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
    if proposed is not null then perform public.validate_sync_value(c->>'table', proposed); end if;
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
    select sr.kind,sr.data
      from jsonb_array_elements(changes) c
      join public.sync_record_data sr on sr.owner_id=actor and sr.kind='decks' and not sr.deleted and sr.data->'wordIds' ? (c.value->>'key')
      where c.value->>'table'='words'
    union
    select sr.kind,sr.data
      from jsonb_array_elements(changes) c
      join public.sync_record_data sr on sr.owner_id=actor and sr.kind='collections' and not sr.deleted and sr.data->'deckIds' ? (c.value->>'key')
      where c.value->>'table'='decks'
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

-- Staging is restartable. Receipts and tombstones remain durable for long-offline devices.
create function public.prune_sync_staging() returns bigint
language plpgsql security definer set search_path='' as $$
declare owner uuid; removed bigint := 0; count_rows bigint;
begin
  for owner in select distinct owner_id from public.sync_staging where created_at < now()-interval '30 days' loop
    perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
    delete from public.sync_staging where owner_id=owner and created_at < now()-interval '30 days';
    get diagnostics count_rows = row_count;
    removed := removed + count_rows;
  end loop;
  return removed;
end; $$;
revoke all on function public.prune_sync_staging() from public,anon,authenticated;
grant execute on function public.prune_sync_staging() to service_role;
