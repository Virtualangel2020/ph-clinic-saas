-- Family Profiles Phase 2 (first slice): adult-to-adult household linking
-- by Patient ID + accept/decline, then explicit per-dependent access
-- grants — per Angel's spec: linking by itself grants NO access to either
-- adult's own record or to each other's dependents; access to a specific
-- dependent is a separate, explicit action the grantor takes afterward
-- (with an "all at once" shortcut). Reuses the EXISTING
-- mycaredesk_account_managers join table for the actual access grant
-- (exactly the mechanism this session already built and hardened for
-- co-parents) rather than inventing a second permissions table — every
-- RLS policy that already keys off is_my_mycaredesk_account_or_managed()
-- (health profiles, clinic patient/appointment access, patient-photos
-- storage) picks up a newly-granted manager automatically, with zero
-- other policy changes needed.

create table public.mycaredesk_adult_links (
  id uuid primary key default gen_random_uuid(),
  requester_account_id uuid not null references public.mycaredesk_accounts(id) on delete cascade,
  recipient_account_id uuid not null references public.mycaredesk_accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','revoked')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mycaredesk_adult_links_not_self check (requester_account_id <> recipient_account_id)
);

-- At most one live (pending or accepted) link between any two accounts,
-- regardless of who requested it.
create unique index mycaredesk_adult_links_active_pair_idx
  on public.mycaredesk_adult_links (least(requester_account_id, recipient_account_id), greatest(requester_account_id, recipient_account_id))
  where status in ('pending','accepted');
create index mycaredesk_adult_links_requester_idx on public.mycaredesk_adult_links(requester_account_id);
create index mycaredesk_adult_links_recipient_idx on public.mycaredesk_adult_links(recipient_account_id);

-- No client-facing RLS policies, same pattern as mycaredesk_account_managers
-- — every read/write goes through a SECURITY DEFINER RPC below so each one
-- can enforce its own real authorization instead of a table-wide policy.
alter table public.mycaredesk_adult_links enable row level security;

-- Look up an adult (must have their own login — never a dependent) by
-- their public Patient ID, before sending a link request. Deliberately
-- returns almost nothing beyond a name match (no DOB/contact info) and
-- flags whether a link already exists so the UI can show the right state
-- instead of letting a duplicate request hit the unique-index error.
create or replace function public.find_mycaredesk_account_by_patient_number(p_patient_number text)
returns table(id uuid, first_name text, last_name text, already_linked boolean, request_pending boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_found_id uuid;
  v_first text;
  v_last text;
begin
  select a.id into v_me from public.mycaredesk_accounts a where a.auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Set up your MyCareDesk account first.';
  end if;

  select a.id, a.first_name, a.last_name into v_found_id, v_first, v_last
  from public.mycaredesk_accounts a
  where upper(a.patient_number) = upper(trim(p_patient_number))
    and a.status = 'active'
    and a.auth_user_id is not null;

  if v_found_id is null then
    return;
  end if;
  if v_found_id = v_me then
    raise exception 'That''s your own Patient ID.';
  end if;

  return query
    select
      v_found_id,
      v_first,
      v_last,
      exists(
        select 1 from public.mycaredesk_adult_links l
        where l.status = 'accepted'
          and ((l.requester_account_id = v_me and l.recipient_account_id = v_found_id)
            or (l.requester_account_id = v_found_id and l.recipient_account_id = v_me))
      ),
      exists(
        select 1 from public.mycaredesk_adult_links l
        where l.status = 'pending'
          and ((l.requester_account_id = v_me and l.recipient_account_id = v_found_id)
            or (l.requester_account_id = v_found_id and l.recipient_account_id = v_me))
      );
end;
$function$;

create or replace function public.request_mycaredesk_adult_link(p_recipient_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_recipient_ok boolean;
  v_id uuid;
begin
  select a.id into v_me from public.mycaredesk_accounts a where a.auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Set up your MyCareDesk account first.';
  end if;
  if p_recipient_account_id = v_me then
    raise exception 'You can''t link to your own account.';
  end if;

  select exists(select 1 from public.mycaredesk_accounts where id = p_recipient_account_id and status = 'active' and auth_user_id is not null)
    into v_recipient_ok;
  if not v_recipient_ok then
    raise exception 'That Patient ID doesn''t match an account we can link to.';
  end if;

  begin
    insert into public.mycaredesk_adult_links (requester_account_id, recipient_account_id)
    values (v_me, p_recipient_account_id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You already have a pending or active link with this person.';
  end;

  return v_id;
end;
$function$;

-- Both directions (I requested it, or it was requested of me), so a
-- single call powers the whole "Family Requests" panel.
create or replace function public.patient_list_my_adult_link_requests()
returns table(id uuid, direction text, other_account_id uuid, other_first_name text, other_last_name text, requested_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select l.id,
    case when a.auth_user_id = auth.uid() then 'outgoing' else 'incoming' end as direction,
    case when a.auth_user_id = auth.uid() then l.recipient_account_id else l.requester_account_id end as other_account_id,
    o.first_name, o.last_name, l.requested_at
  from public.mycaredesk_adult_links l
  join public.mycaredesk_accounts a on a.id = l.requester_account_id
  join public.mycaredesk_accounts o on o.id = (case when a.auth_user_id = auth.uid() then l.recipient_account_id else l.requester_account_id end)
  where l.status = 'pending'
    and (l.requester_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid())
      or l.recipient_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid()))
  order by l.requested_at desc;
$function$;

-- Recipient-only accept/decline.
create or replace function public.respond_to_mycaredesk_adult_link_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_recipient uuid;
  v_status text;
begin
  select a.id into v_me from public.mycaredesk_accounts a where a.auth_user_id = auth.uid();
  select recipient_account_id, status into v_recipient, v_status from public.mycaredesk_adult_links where id = p_request_id;
  if v_recipient is null then
    raise exception 'Request not found.';
  end if;
  if v_recipient <> v_me then
    raise exception 'not authorized';
  end if;
  if v_status <> 'pending' then
    raise exception 'This request has already been handled.';
  end if;

  update public.mycaredesk_adult_links
    set status = case when p_approve then 'accepted' else 'declined' end, responded_at = now()
    where id = p_request_id;
end;
$function$;

-- Requester-only cancel of a still-pending outgoing request.
create or replace function public.cancel_mycaredesk_adult_link_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_requester uuid;
  v_status text;
begin
  select a.id into v_me from public.mycaredesk_accounts a where a.auth_user_id = auth.uid();
  select requester_account_id, status into v_requester, v_status from public.mycaredesk_adult_links where id = p_request_id;
  if v_requester is null then
    raise exception 'Request not found.';
  end if;
  if v_requester <> v_me then
    raise exception 'not authorized';
  end if;
  if v_status <> 'pending' then
    raise exception 'This request has already been handled.';
  end if;

  update public.mycaredesk_adult_links set status = 'cancelled', responded_at = now() where id = p_request_id;
end;
$function$;

create or replace function public.get_my_mycaredesk_linked_adults()
returns table(link_id uuid, account_id uuid, first_name text, last_name text, linked_since timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select l.id,
    case when a.auth_user_id = auth.uid() then l.recipient_account_id else l.requester_account_id end,
    o.first_name, o.last_name, l.responded_at
  from public.mycaredesk_adult_links l
  join public.mycaredesk_accounts a on a.id = l.requester_account_id
  join public.mycaredesk_accounts o on o.id = (case when a.auth_user_id = auth.uid() then l.recipient_account_id else l.requester_account_id end)
  where l.status = 'accepted'
    and (l.requester_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid())
      or l.recipient_account_id in (select id from public.mycaredesk_accounts where auth_user_id = auth.uid()))
  order by l.responded_at desc;
$function$;

-- Ending a household link also ends whatever dependent access that
-- specific relationship enabled (in EITHER direction) — per "if we're not
-- linked anymore, no more access." Only revokes grants this link itself
-- produced (invited_by_account_id ties a manager row back to who granted
-- it), never a grant some other linked adult made independently.
create or replace function public.unlink_mycaredesk_adult(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_link record;
begin
  select a.id into v_me from public.mycaredesk_accounts a where a.auth_user_id = auth.uid();
  select * into v_link from public.mycaredesk_adult_links where id = p_link_id and status = 'accepted';
  if v_link.id is null then
    raise exception 'Link not found.';
  end if;
  if v_me not in (v_link.requester_account_id, v_link.recipient_account_id) then
    raise exception 'not authorized';
  end if;

  update public.mycaredesk_adult_links set status = 'revoked', responded_at = now() where id = p_link_id;

  update public.mycaredesk_account_managers
    set status = 'revoked', revoked_at = now()
    where status = 'active'
      and (
        (manager_account_id = v_link.requester_account_id and invited_by_account_id = v_link.recipient_account_id)
        or (manager_account_id = v_link.recipient_account_id and invited_by_account_id = v_link.requester_account_id)
      );
end;
$function$;

-- Grant a linked adult access to ONE dependent. Deliberately restricted to
-- dependent accounts (auth_user_id is null) — per Angel, linking a spouse
-- never implies access to each other's OWN record, only to shared
-- dependents either of them explicitly shares. Requires an accepted link
-- between the grantor and the grantee (linking is the trust boundary that
-- makes granting meaningful) and that the grantor already actively
-- manages the dependent.
create or replace function public.grant_mycaredesk_account_access(
  p_account_id uuid,
  p_manager_account_id uuid,
  p_relationship text,
  p_relationship_other_description text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_is_dependent boolean;
  v_linked boolean;
begin
  select a.id into v_me from public.mycaredesk_accounts a where a.auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Set up your MyCareDesk account first.';
  end if;
  if not public.is_my_mycaredesk_account_or_managed(p_account_id) then
    raise exception 'not authorized';
  end if;

  select (auth_user_id is null) into v_is_dependent from public.mycaredesk_accounts where id = p_account_id;
  if not coalesce(v_is_dependent, false) then
    raise exception 'You can only share access to a dependent, not to a login''s own account.';
  end if;

  select exists(
    select 1 from public.mycaredesk_adult_links l
    where l.status = 'accepted'
      and ((l.requester_account_id = v_me and l.recipient_account_id = p_manager_account_id)
        or (l.requester_account_id = p_manager_account_id and l.recipient_account_id = v_me))
  ) into v_linked;
  if not v_linked then
    raise exception 'Link that person''s account first before sharing access.';
  end if;

  insert into public.mycaredesk_account_managers
    (account_id, manager_account_id, relationship, relationship_other_description, status, is_primary, invited_by_account_id, accepted_at)
  values
    (p_account_id, p_manager_account_id, p_relationship, p_relationship_other_description, 'active', false, v_me, now())
  on conflict (account_id, manager_account_id) where status in ('pending','active')
    do nothing;
end;
$function$;

-- "Give access to all" shortcut — same rule per dependent, skips any
-- dependent that manager already actively manages.
create or replace function public.grant_mycaredesk_account_access_all(
  p_manager_account_id uuid,
  p_relationship text,
  p_relationship_other_description text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_linked boolean;
  v_count integer := 0;
  v_dep record;
begin
  select a.id into v_me from public.mycaredesk_accounts a where a.auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Set up your MyCareDesk account first.';
  end if;

  select exists(
    select 1 from public.mycaredesk_adult_links l
    where l.status = 'accepted'
      and ((l.requester_account_id = v_me and l.recipient_account_id = p_manager_account_id)
        or (l.requester_account_id = p_manager_account_id and l.recipient_account_id = v_me))
  ) into v_linked;
  if not v_linked then
    raise exception 'Link that person''s account first before sharing access.';
  end if;

  for v_dep in
    select m.account_id
    from public.mycaredesk_account_managers m
    join public.mycaredesk_accounts d on d.id = m.account_id
    where m.manager_account_id = v_me and m.status = 'active' and d.auth_user_id is null
  loop
    insert into public.mycaredesk_account_managers
      (account_id, manager_account_id, relationship, relationship_other_description, status, is_primary, invited_by_account_id, accepted_at)
    values
      (v_dep.account_id, p_manager_account_id, p_relationship, p_relationship_other_description, 'active', false, v_me, now())
    on conflict (account_id, manager_account_id) where status in ('pending','active')
      do nothing;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$function$;

create or replace function public.revoke_mycaredesk_account_access(p_account_id uuid, p_manager_account_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_active_count integer;
begin
  select a.id into v_me from public.mycaredesk_accounts a where a.auth_user_id = auth.uid();
  if not public.is_my_mycaredesk_account_or_managed(p_account_id) then
    raise exception 'not authorized';
  end if;
  if p_manager_account_id = v_me then
    raise exception 'Use a different flow to remove yourself.';
  end if;

  select count(*) into v_active_count from public.mycaredesk_account_managers where account_id = p_account_id and status = 'active';
  if v_active_count <= 1 then
    raise exception 'Every dependent needs at least one active manager.';
  end if;

  update public.mycaredesk_account_managers
    set status = 'revoked', revoked_at = now()
    where account_id = p_account_id and manager_account_id = p_manager_account_id and status = 'active';
end;
$function$;
