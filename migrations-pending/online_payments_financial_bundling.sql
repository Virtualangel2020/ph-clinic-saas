-- ============================================================================
-- Online Payments auto-includes Financial (spec §11-16, Phase 2)
-- ============================================================================
-- Financial (financial_tracker) and Online Payments (patient_payments) stay
-- two independent addons/prices — superadmin still sets pricing for each
-- separately in Settings, nothing hardcoded — but purchasing Online
-- Payments must auto-activate Financial without separately billing it.
-- included_via_addon_id marks exactly that: when set, this
-- subscription_addons row is active *because* another addon bundled it
-- in, not because it was purchased on its own — so pricing UIs can show
-- "Included with X" instead of a price, and cancelling X can prompt
-- "keep using this standalone?" instead of silently deleting it.

alter table subscription_addons
  add column if not exists included_via_addon_id uuid references public.addons(id);

comment on column subscription_addons.included_via_addon_id is
  'Set when this addon is active only because another addon (e.g. Online Payments bundling in Financial) included it — not a separate purchase. NULL means this addon''s active status is its own, whether the tenant pays for it directly or a superadmin granted it manually.';

-- admin_set_tenant_addon — same 4-arg signature (safe CREATE OR REPLACE,
-- no overload risk) — now also handles the Online Payments -> Financial
-- bundle-activate on enable. Deliberately does NOT auto-cancel Financial
-- when Online Payments is disabled here — that decision belongs to the
-- explicit "keep using Financial?" prompt (admin_cancel_online_payments_addon
-- below), never a silent side effect of unchecking one box.
create or replace function public.admin_set_tenant_addon(p_tenant_id uuid, p_addon_id uuid, p_enabled boolean, p_billing_cycle subscription_billing_cycle default 'monthly'::subscription_billing_cycle)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_subscription_id uuid;
  v_patient_payments_id uuid;
  v_financial_id uuid;
  v_financial_row subscription_addons;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select id into v_subscription_id from public.subscriptions where tenant_id = p_tenant_id;
  if v_subscription_id is null then
    raise exception 'tenant has no subscription yet';
  end if;

  if p_enabled then
    insert into public.subscription_addons (subscription_id, addon_id, billing_cycle, status, since, included_via_addon_id)
    values (v_subscription_id, p_addon_id, p_billing_cycle, 'active', now(), null)
    on conflict (subscription_id, addon_id) do update set status = 'active', until = null,
      -- Re-enabling an addon directly always makes it a real purchase again,
      -- even if it happened to be bundle-included before.
      included_via_addon_id = null;
  else
    update public.subscription_addons
    set status = 'cancelled', until = now()
    where subscription_id = v_subscription_id and addon_id = p_addon_id;
  end if;

  select id into v_patient_payments_id from public.addons where feature_key = 'patient_payments';
  select id into v_financial_id from public.addons where feature_key = 'financial_tracker';

  if p_enabled and v_patient_payments_id is not null and v_financial_id is not null and p_addon_id = v_patient_payments_id then
    select * into v_financial_row from public.subscription_addons where subscription_id = v_subscription_id and addon_id = v_financial_id;
    -- Only bundle it in if Financial isn't already an independent, active
    -- purchase — never overwrite/clobber a tenant that bought Financial
    -- on its own.
    if v_financial_row.id is null or v_financial_row.status is distinct from 'active' or v_financial_row.included_via_addon_id is not null then
      insert into public.subscription_addons (subscription_id, addon_id, billing_cycle, status, since, included_via_addon_id)
      values (v_subscription_id, v_financial_id, p_billing_cycle, 'active', now(), v_patient_payments_id)
      on conflict (subscription_id, addon_id) do update set status = 'active', until = null, included_via_addon_id = v_patient_payments_id;

      insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
      values (p_tenant_id, auth.uid(), 'financial_bundled_via_online_payments', 'subscription_addons', v_subscription_id, null, jsonb_build_object('included_via_addon_id', v_patient_payments_id));
    end if;
  end if;

  perform public.sync_tenant_entitlements(p_tenant_id);
end;
$function$;

-- admin_cancel_online_payments_addon — the explicit "Would you like to
-- continue using Financial?" decision point (§16). Only meaningful (and
-- only expected to be called by the UI) when Financial is currently
-- bundle-included via Online Payments; harmless no-op on the Financial
-- side otherwise. Never deletes financial history — patient_charges and
-- every other financial-ledger row are untouched either way; this only
-- ever changes subscription_addons/tenant_entitlements rows.
create or replace function public.admin_cancel_online_payments_addon(p_tenant_id uuid, p_keep_financial boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_subscription_id uuid;
  v_patient_payments_id uuid;
  v_financial_id uuid;
  v_financial_row subscription_addons;
begin
  if not public.is_platform_admin() then raise exception 'not authorized'; end if;

  select id into v_subscription_id from public.subscriptions where tenant_id = p_tenant_id;
  if v_subscription_id is null then raise exception 'tenant has no subscription yet'; end if;

  select id into v_patient_payments_id from public.addons where feature_key = 'patient_payments';
  select id into v_financial_id from public.addons where feature_key = 'financial_tracker';
  if v_patient_payments_id is null or v_financial_id is null then raise exception 'addon catalog not configured'; end if;

  update public.subscription_addons
  set status = 'cancelled', until = now()
  where subscription_id = v_subscription_id and addon_id = v_patient_payments_id;

  select * into v_financial_row from public.subscription_addons where subscription_id = v_subscription_id and addon_id = v_financial_id;

  if v_financial_row.id is not null and v_financial_row.status = 'active' and v_financial_row.included_via_addon_id = v_patient_payments_id then
    if p_keep_financial then
      update public.subscription_addons set included_via_addon_id = null where id = v_financial_row.id;
    else
      update public.subscription_addons set status = 'cancelled', until = now() where id = v_financial_row.id;
    end if;

    insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      p_tenant_id, auth.uid(), 'online_payments_cancelled_financial_choice', 'subscription_addons', v_subscription_id,
      jsonb_build_object('financial_bundled', true),
      jsonb_build_object('financial_kept_standalone', p_keep_financial)
    );
  end if;

  perform public.sync_tenant_entitlements(p_tenant_id);
end;
$function$;
