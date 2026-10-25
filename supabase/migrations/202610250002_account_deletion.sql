-- A durable deletion intent outlives Auth and makes partial cleanup resumable.
create table public.account_deletion_jobs (
  owner_id uuid primary key,
  cleanup_token uuid not null,
  status text not null default 'pending' check(status in ('pending','complete')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text
);
alter table public.account_deletion_jobs enable row level security;
revoke all on public.account_deletion_jobs from anon, authenticated;
grant select on public.account_deletion_jobs to authenticated;
grant all on public.account_deletion_jobs to service_role;
create policy own_deletion_status on public.account_deletion_jobs for select to authenticated
  using (owner_id=(select auth.uid()));

create function public.account_available() returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from public.account_deletion_jobs where owner_id=auth.uid());
$$;
revoke all on function public.account_available() from public,anon;
grant execute on function public.account_available() to authenticated;
-- Restrictive policies also protect sessions issued before deletion was requested.
create policy deletion_blocks_records on public.sync_record_data as restrictive for all to authenticated
  using ((select public.account_available())) with check ((select public.account_available()));
create policy deletion_blocks_progress on public.card_progress as restrictive for all to authenticated
  using ((select public.account_available())) with check ((select public.account_available()));
create policy deletion_blocks_profile on public.profiles as restrictive for all to authenticated
  using ((select public.account_available())) with check ((select public.account_available()));
create policy deletion_blocks_images on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'card-images' or (select public.account_available()))
  with check (bucket_id <> 'card-images' or (select public.account_available()));

create function public.request_account_deletion(target_owner uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_owner::text,0));
  select cleanup_token into result from public.account_deletion_jobs where owner_id=target_owner;
  if found then return result; end if;
  result := public.begin_image_cleanup(target_owner);
  insert into public.account_deletion_jobs(owner_id,cleanup_token) values(target_owner,result);
  return result;
end; $$;
revoke all on function public.request_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.request_account_deletion(uuid) to service_role;

create function public.account_deletion_pending() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.account_deletion_jobs where owner_id=auth.uid() and status='pending');
$$;
revoke all on function public.account_deletion_pending() from public,anon;
grant execute on function public.account_deletion_pending() to authenticated;
