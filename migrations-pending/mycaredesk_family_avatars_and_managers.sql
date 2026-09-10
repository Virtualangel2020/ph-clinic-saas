-- Family Profiles Phase 1.9/1.10: dependent photo avatars + "who manages
-- this person" lookup.
--
-- 1. The patient-photos storage policies (insert/update/select) were still
--    scoped to `mycaredesk_accounts.auth_user_id = auth.uid()` — i.e. only
--    a profile's OWN login could ever read or write its photo folder. A
--    dependent has no login, so this silently blocked EVERY co-manager
--    (not just a second one) from ever uploading or even generating a
--    signed URL for a dependent's photo — the same class of gap already
--    found and fixed in several RPCs this session, just in storage policy
--    form instead of a SQL function. Rewritten to go through
--    is_my_mycaredesk_account_or_managed(), the same join-table-aware
--    helper every other multi-guardian check in this project uses.
drop policy if exists "patients manage own photo" on storage.objects;
create policy "patients manage own photo" on storage.objects for insert
  with check (
    bucket_id = 'patient-photos'
    and public.is_my_mycaredesk_account_or_managed(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "patients replace own photo" on storage.objects;
create policy "patients replace own photo" on storage.objects for update
  using (
    bucket_id = 'patient-photos'
    and public.is_my_mycaredesk_account_or_managed(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "patients view own photo" on storage.objects;
create policy "patients view own photo" on storage.objects for select
  using (
    bucket_id = 'patient-photos'
    and public.is_my_mycaredesk_account_or_managed(((storage.foldername(name))[1])::uuid)
  );

-- 2. "Who manages this person" — powers the new My Family screen (spec
-- 1.10). Authorized the same way as every other per-account read: self or
-- an active manager. Returns the OTHER active managers' names/relationship
-- plus whether the caller is looking at themselves in that list, so the UI
-- can render "Managed by: You, Jane Doe".
create or replace function public.get_mycaredesk_account_managers(p_account_id uuid)
returns table(
  manager_account_id uuid,
  first_name text,
  last_name text,
  relationship text,
  relationship_other_description text,
  is_primary boolean,
  is_me boolean,
  accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_my_mycaredesk_account_or_managed(p_account_id) then
    raise exception 'not authorized';
  end if;

  return query
    select
      m.manager_account_id,
      a.first_name,
      a.last_name,
      m.relationship,
      m.relationship_other_description,
      m.is_primary,
      (a.auth_user_id = auth.uid()) as is_me,
      m.accepted_at
    from public.mycaredesk_account_managers m
    join public.mycaredesk_accounts a on a.id = m.manager_account_id
    where m.account_id = p_account_id and m.status = 'active'
    order by m.is_primary desc, m.created_at asc;
end;
$function$;
