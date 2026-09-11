-- Angel: "if Im doing a system update, do not allow anybody to create an
-- account or login, just let them know system is currently under
-- maintenance and will be back in a few minutes."
--
-- Singleton settings row, same pattern as commerce_settings/
-- whatsapp_settings (id boolean primary key default true, one row,
-- publicly readable, platform-admin-only to write) — a signed-out visitor
-- on /login, /signup, /patient-signup, or /portal/login has to be able to
-- read this before they're authenticated at all, so it can't be gated
-- behind requireAdmin()/is_platform_admin() for SELECT.
--
-- Deliberately does NOT touch /admin/login or anything under /admin/* —
-- Angel is the one flipping this switch from /admin/settings, so the
-- superadmin console has to stay reachable while maintenance mode is on or
-- she'd lock herself out of turning it back off.
create table public.maintenance_settings (
  id boolean primary key default true,
  is_enabled boolean not null default false,
  message text not null default 'MyCareDesk is currently undergoing a quick system update. We''ll be back in just a few minutes — thanks for your patience!',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint maintenance_settings_singleton check (id)
);

insert into public.maintenance_settings (id) values (true);

alter table public.maintenance_settings enable row level security;

create policy "maintenance settings are publicly readable"
  on public.maintenance_settings for select
  using (true);

create policy "platform admins manage maintenance settings"
  on public.maintenance_settings for all
  using (is_platform_admin())
  with check (is_platform_admin());

create or replace function public.admin_set_maintenance_settings(p_is_enabled boolean, p_message text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'not authorized';
  end if;
  update public.maintenance_settings
  set is_enabled = p_is_enabled,
      message = coalesce(nullif(trim(p_message), ''), message),
      updated_at = now(),
      updated_by = auth.uid()
  where id = true;
end;
$function$;

grant execute on function public.admin_set_maintenance_settings(boolean, text) to authenticated;
