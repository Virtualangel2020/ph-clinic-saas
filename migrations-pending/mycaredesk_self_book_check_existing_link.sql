-- Lets the booking wizard know, before the patient commits, whether this
-- is a brand-new connection to this provider's clinic (so it can show a
-- "your profile will be shared with this provider" consent step) or a
-- clinic they're already connected to (already agreed to this once).
-- Read-only, mirrors the same lookup self_book_ensure_clinic_patient does
-- internally before deciding whether to create anything — no side effects.
create or replace function public.self_book_check_existing_link(p_provider_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_account_id uuid;
  v_tenant_id uuid;
  v_patient_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select id into v_account_id from public.mycaredesk_accounts where auth_user_id = auth.uid();
  if v_account_id is null then
    return false;
  end if;

  select tenant_id into v_tenant_id from public.user_profiles where id = p_provider_id and is_active = true;
  if v_tenant_id is null then
    return false;
  end if;

  select id into v_patient_id from public.patients
  where tenant_id = v_tenant_id and mycaredesk_account_id = v_account_id;

  return v_patient_id is not null;
end;
$$;

revoke all on function public.self_book_check_existing_link(uuid) from public;
grant execute on function public.self_book_check_existing_link(uuid) to authenticated;
