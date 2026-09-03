"use client";

import { useMemo, useState, useTransition } from "react";
import { createTargetedPromotionAction } from "@/app/admin/actions";

type Plan = { id: string; name: string; plan_prices: { billing_cycle: string; price_php: number }[] };
type Addon = { id: string; name: string };
type Tenant = { id: string; name: string };

// The five promotion "types" Angel asked for map onto two DB columns
// (discount_type: 'percent' | 'fixed_amount' | 'free_trial') plus a
// duration config — there's no separate "introductory price" or "free
// period" concept in the schema. "Introductory price" is a fixed-amount
// discount where this form works out the peso amount from (current price −
// intro price) for you; "free period" is just a 100%-off percent discount
// for a fixed duration. All three submit through the exact same
// admin_create_targeted_promotion RPC and the exact same
// compute_promotion_discount validation — this mapping is a UI convenience,
// not a separate code path. "Free Trial" is its own real discount_type
// (trial_duration_days + an optional follow_on_promotion_id) — see
// promotions_free_trial_and_scope migration. Note: there's no live
// self-serve trial signup/provisioning flow yet, so a Free Trial promotion
// created here defines the terms but has nothing to attach to until that
// separate feature ships.
type PromoType = "percent" | "fixed_amount" | "intro_price" | "free_period" | "free_trial";

// "One-time payment" is deliberately not a promotion duration — that's a
// separate Superadmin-configured product (commerce_settings.offer_one_time),
// not something a promotion discounts. See promotions_free_trial_and_scope
// migration, which dropped 'one_payment' from the DB CHECK constraint.
type DurationType = "billing_cycles" | "months" | "until_date" | "ongoing";

const DURATION_LABELS: Record<DurationType, string> = {
  billing_cycles: "For the first N billing cycles",
  months: "For the first N months",
  until_date: "Until a specific date",
  ongoing: "For as long as the promo is active (no end date)",
};

type Scope = "core_only" | "core_plus_providers" | "selected_addons" | "entire_subscription";
const SCOPE_LABELS: Record<Scope, string> = {
  core_only: "Core Subscription Only",
  core_plus_providers: "Core + Additional Providers",
  selected_addons: "Selected Eligible Add-ons",
  entire_subscription: "Entire Eligible Subscription",
};

function priceFor(plan: Plan | undefined, cycle: string) {
  const p = plan?.plan_prices.find((x) => x.billing_cycle === cycle);
  return p ? Number(p.price_php) : null;
}

type ExistingPromotion = { id: string; label: string; discount_type: string };

export function PromotionForm({
  plans,
  addons,
  tenants,
  existingPromotions,
}: {
  plans: Plan[];
  addons: Addon[];
  tenants: Tenant[];
  existingPromotions: ExistingPromotion[];
}) {
  const [type, setType] = useState<PromoType>("percent");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  const [discountPercent, setDiscountPercent] = useState("20");
  const [fixedAmountPhp, setFixedAmountPhp] = useState("500");

  const [introPlanId, setIntroPlanId] = useState("");
  const [introCycle, setIntroCycle] = useState<"monthly" | "yearly">("monthly");
  const [introPrice, setIntroPrice] = useState("");

  // Free Trial only.
  const [trialDurationDays, setTrialDurationDays] = useState("30");
  const [followWithPromotion, setFollowWithPromotion] = useState(false);
  const [followOnPromotionId, setFollowOnPromotionId] = useState("");

  const [appliesToPlanId, setAppliesToPlanId] = useState(""); // "" = all plans

  // Scope selector (section 40 of Angel's directive) — maps onto the
  // existing applies_to_seats boolean + applies_to_addon_ids array under
  // the hood. Defaults to Core Subscription Only, and a Free Trial promo is
  // locked to it (also enforced by a DB CHECK constraint).
  const [scope, setScope] = useState<Scope>("core_only");
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const appliesToSeats = type !== "free_trial" && (scope === "core_plus_providers" || scope === "entire_subscription");
  const appliesToAddonIds = type === "free_trial" ? new Set<string>() : scope === "entire_subscription" ? new Set(addons.map((a) => a.id)) : scope === "selected_addons" ? selectedAddonIds : new Set<string>();

  // "First N billing cycles/months" only ever applies on a monthly
  // checkout (see compute_promotion_discount) — locking the billing-cycle
  // scope to monthly whenever one of those duration types is picked avoids
  // building a promo that silently never applies to a yearly purchase.
  const [durationType, setDurationType] = useState<DurationType>("ongoing");
  const [durationValue, setDurationValue] = useState("3");
  const durationForcesMonthly = durationType === "billing_cycles" || durationType === "months";

  const [billingCycleScope, setBillingCycleScope] = useState<"" | "monthly" | "yearly" | "both">("");
  const effectiveBillingCycleScope = type === "intro_price" ? introCycle : durationForcesMonthly ? "monthly" : billingCycleScope;

  const [endsAt, setEndsAt] = useState(""); // also doubles as the duration_type='until_date' end date
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [code, setCode] = useState("");
  const [requiresCode, setRequiresCode] = useState(false);
  const [targetTenantId, setTargetTenantId] = useState("");

  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const durationOptions: DurationType[] = useMemo(() => {
    if (type === "free_period") {
      // "Free forever" isn't a period — that's closer to a free trial, so
      // it's deliberately excluded here.
      return ["billing_cycles", "months", "until_date"];
    }
    return ["billing_cycles", "months", "until_date", "ongoing"];
  }, [type]);

  const followOnCandidates = existingPromotions.filter((p) => p.discount_type !== "free_trial");

  const introPlan = plans.find((p) => p.id === introPlanId);
  const introBasePrice = priceFor(introPlan, introCycle);
  const introComputedDiscount =
    introBasePrice !== null && introPrice.trim() !== "" ? introBasePrice - Number(introPrice) : null;

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function resetForm() {
    setLabel("");
    setDescription("");
    setCode("");
    setIntroPrice("");
    setFollowWithPromotion(false);
    setFollowOnPromotionId("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!label.trim()) {
      setMessage("Error: give this promotion a name.");
      return;
    }

    let discountType: "percent" | "fixed_amount" | "free_trial";
    let discountPercentValue: number | null = null;
    let fixedAmountValue: number | null = null;
    let finalAppliesToPlanId = appliesToPlanId || null;
    let finalDurationType: DurationType = durationType;
    let finalDurationValue: number | null = null;
    let finalBillingCycleScope: "monthly" | "yearly" | "both" | null = effectiveBillingCycleScope || null;
    let trialDurationDaysValue: number | null = null;
    let followOnPromotionIdValue: string | null = null;

    if (type === "percent") {
      const pct = Number(discountPercent);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        setMessage("Error: discount % must be between 1 and 100.");
        return;
      }
      discountType = "percent";
      discountPercentValue = pct;
    } else if (type === "fixed_amount") {
      const amt = Number(fixedAmountPhp);
      if (isNaN(amt) || amt <= 0) {
        setMessage("Error: fixed amount must be a positive number.");
        return;
      }
      discountType = "fixed_amount";
      fixedAmountValue = amt;
    } else if (type === "intro_price") {
      if (!introPlanId) {
        setMessage("Error: pick which plan this introductory price is for.");
        return;
      }
      if (introBasePrice === null) {
        setMessage(`Error: that plan isn't priced for ${introCycle} billing.`);
        return;
      }
      const intro = Number(introPrice);
      if (introPrice.trim() === "" || isNaN(intro) || intro < 0) {
        setMessage("Error: enter the introductory price.");
        return;
      }
      if (intro >= introBasePrice) {
        setMessage("Error: the introductory price should be less than the regular price.");
        return;
      }
      discountType = "fixed_amount";
      fixedAmountValue = introBasePrice - intro;
      finalAppliesToPlanId = introPlanId;
    } else if (type === "free_trial") {
      const days = Number(trialDurationDays);
      if (isNaN(days) || days <= 0) {
        setMessage("Error: enter the trial length in days.");
        return;
      }
      if (followWithPromotion && !followOnPromotionId) {
        setMessage("Error: pick the promotion to follow the trial with, or turn that off.");
        return;
      }
      discountType = "free_trial";
      trialDurationDaysValue = days;
      followOnPromotionIdValue = followWithPromotion ? followOnPromotionId : null;
      // A trial has no discount duration of its own — it's just a length
      // in days — so duration_type/billing_cycle_scope are sent as
      // harmless DB-required defaults, unused by free-trial logic.
      finalDurationType = "ongoing";
      finalBillingCycleScope = "both";
    } else {
      // free_period
      discountType = "percent";
      discountPercentValue = 100;
      if (!durationValue.trim() && durationType !== "until_date") {
        setMessage("Error: a free period needs a duration.");
        return;
      }
    }

    if (type !== "free_trial") {
      if ((durationType === "billing_cycles" || durationType === "months") && !durationValue.trim()) {
        setMessage("Error: enter how many.");
        return;
      }
      if (durationType === "until_date" && !endsAt) {
        setMessage("Error: pick the end date.");
        return;
      }
      finalDurationValue = durationType === "billing_cycles" || durationType === "months" ? Number(durationValue) : null;
    }

    startTransition(async () => {
      try {
        await createTargetedPromotionAction({
          label: label.trim(),
          description: description.trim(),
          discountType,
          discountPercent: discountPercentValue,
          fixedAmountPhp: fixedAmountValue,
          durationType: finalDurationType,
          durationValue: finalDurationValue,
          durationValueMonthly: null,
          durationValueYearly: null,
          appliesToPlanId: finalAppliesToPlanId,
          appliesToSeats,
          appliesToAddonIds: Array.from(appliesToAddonIds),
          billingCycleScope: finalBillingCycleScope,
          applyToFutureAdditions: false,
          targetTenantId: targetTenantId || null,
          code: code.trim() ? code.trim().toUpperCase() : null,
          requiresCode: requiresCode && !!code.trim(),
          maxRedemptions: maxRedemptions.trim() === "" ? null : Number(maxRedemptions),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          trialDurationDays: trialDurationDaysValue,
          followOnPromotionId: followOnPromotionIdValue,
        });
        setMessage("Promotion created — it's live now.");
        resetForm();
      } catch (err: any) {
        setMessage(`Error: ${err.message}`);
      }
    });
  }

  return (
    <form onSubmit={submit} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Create a promotion</h2>

      <div style={{ marginBottom: 14 }}>
        <label style={label_}>Type</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(
            [
              ["percent", "Percentage off"],
              ["fixed_amount", "Fixed amount off"],
              ["intro_price", "Introductory price"],
              ["free_trial", "Free trial"],
              ["free_period", "Free billing period"],
            ] as [PromoType, string][]
          ).map(([value, text]) => (
            <button
              type="button"
              key={value}
              onClick={() => setType(value)}
              style={{ ...chip, borderColor: type === value ? "#2563eb" : "#ddd", background: type === value ? "#eff4ff" : "white" }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label_}>Name (shown to you internally)</label>
          <input required placeholder='e.g. "Launch intro price"' value={label} onChange={(e) => setLabel(e.target.value)} style={input} />
        </div>
        <div>
          <label style={label_}>Description (optional, internal)</label>
          <input placeholder="Any extra context for your own records" value={description} onChange={(e) => setDescription(e.target.value)} style={input} />
        </div>
      </div>

      {type === "percent" && (
        <div style={{ marginBottom: 12 }}>
          <label style={label_}>Discount %</label>
          <input type="number" min={1} max={100} required value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} style={{ ...input, width: 140 }} />
        </div>
      )}

      {type === "fixed_amount" && (
        <div style={{ marginBottom: 12 }}>
          <label style={label_}>Amount off (₱)</label>
          <input type="number" min={1} required value={fixedAmountPhp} onChange={(e) => setFixedAmountPhp(e.target.value)} style={{ ...input, width: 140 }} />
        </div>
      )}

      {type === "intro_price" && (
        <div style={{ background: "#f7f8fa", border: "1px solid #eee", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={label_}>Plan</label>
              <select required value={introPlanId} onChange={(e) => setIntroPlanId(e.target.value)} style={input}>
                <option value="">Select a plan…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label_}>Billing cycle</label>
              <select value={introCycle} onChange={(e) => setIntroCycle(e.target.value as any)} style={input}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label style={label_}>Intro price (₱)</label>
              <input type="number" min={0} required value={introPrice} onChange={(e) => setIntroPrice(e.target.value)} style={input} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#666", margin: "10px 0 0" }}>
            {introBasePrice === null
              ? "This plan isn't priced for that billing cycle."
              : introComputedDiscount !== null
              ? `Regular price is ₱${introBasePrice.toLocaleString()} — this works out to ₱${introComputedDiscount.toLocaleString()} off.`
              : `Regular price is ₱${introBasePrice.toLocaleString()}.`}
          </p>
        </div>
      )}

      {type === "free_period" && (
        <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
          100% off for the duration you set below — set exactly how long underneath.
        </p>
      )}

      {type === "free_trial" && (
        <div style={{ background: "#f7f8fa", border: "1px solid #eee", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: "#666", margin: "0 0 10px" }}>
            A free trial is always Core Subscription Only — no add-ons, no extra provider seats. Note: there's no
            live self-serve trial signup yet, so this defines the terms for when that ships.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <label style={label_}>Trial length (days)</label>
              <input type="number" min={1} required value={trialDurationDays} onChange={(e) => setTrialDurationDays(e.target.value)} style={input} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <input type="checkbox" checked={followWithPromotion} onChange={(e) => setFollowWithPromotion(e.target.checked)} />
                Follow the trial with another promotion
              </label>
              {followWithPromotion && (
                <select value={followOnPromotionId} onChange={(e) => setFollowOnPromotionId(e.target.value)} style={input}>
                  <option value="">Select a promotion…</option>
                  {followOnCandidates.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              )}
              {followWithPromotion && followOnCandidates.length === 0 && (
                <p style={{ fontSize: 11.5, color: "#a12a2a", margin: "6px 0 0" }}>
                  Create the follow-on discount/intro-price promotion first, then come back and link it here.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {type !== "free_trial" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label_}>Duration</label>
            <select value={durationType} onChange={(e) => setDurationType(e.target.value as DurationType)} style={input}>
              {durationOptions.map((d) => (
                <option key={d} value={d}>{DURATION_LABELS[d]}</option>
              ))}
            </select>
          </div>
          {(durationType === "billing_cycles" || durationType === "months") && (
            <div>
              <label style={label_}>How many {durationType === "months" ? "months" : "billing cycles"}</label>
              <input type="number" min={1} required value={durationValue} onChange={(e) => setDurationValue(e.target.value)} style={input} />
            </div>
          )}
          {durationType === "until_date" && (
            <div>
              <label style={label_}>End date</label>
              <input type="date" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={input} />
            </div>
          )}
        </div>
      )}

      {type !== "free_trial" && (
        <div style={{ marginBottom: 12 }}>
          <label style={label_}>Applies to which billing cycles</label>
          {type === "intro_price" ? (
            <p style={{ fontSize: 12.5, color: "#888", margin: 0 }}>{introCycle === "monthly" ? "Monthly" : "Yearly"} only, matching the plan above.</p>
          ) : durationForcesMonthly ? (
            <p style={{ fontSize: 12.5, color: "#888", margin: 0 }}>
              Monthly only — "{DURATION_LABELS[durationType]}" durations only ever apply to a monthly purchase.
            </p>
          ) : (
            <select value={billingCycleScope} onChange={(e) => setBillingCycleScope(e.target.value as any)} style={{ ...input, width: 260 }}>
              <option value="">All billing options (incl. lifetime)</option>
              <option value="monthly">Monthly only</option>
              <option value="yearly">Yearly only</option>
              <option value="both">Monthly &amp; yearly (not lifetime)</option>
            </select>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label_}>Applies to plan</label>
          <select
            value={type === "intro_price" ? introPlanId : appliesToPlanId}
            onChange={(e) => setAppliesToPlanId(e.target.value)}
            disabled={type === "intro_price"}
            style={input}
          >
            <option value="">All plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} only</option>
            ))}
          </select>
        </div>
        <div>
          <label style={label_}>Stop after this many redemptions</label>
          <input type="number" min={1} placeholder="Unlimited" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} style={input} />
        </div>
        <div>
          <label style={label_}>Only for one clinic (optional)</label>
          <select value={targetTenantId} onChange={(e) => setTargetTenantId(e.target.value)} style={input}>
            <option value="">Any eligible clinic</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label_}>Scope</label>
        {type === "free_trial" ? (
          <p style={{ fontSize: 12.5, color: "#888", margin: 0 }}>Core Subscription Only (a free trial can't include add-ons or extra seats).</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setScope(s)}
                  style={{ ...chip, borderColor: scope === s ? "#2563eb" : "#ddd", background: scope === s ? "#eff4ff" : "white" }}
                >
                  {SCOPE_LABELS[s]}
                  {s === "core_only" ? " (default)" : ""}
                </button>
              ))}
            </div>
            {scope === "selected_addons" && addons.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                {addons.map((a) => (
                  <label key={a.id} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="checkbox" checked={selectedAddonIds.has(a.id)} onChange={() => toggleAddon(a.id)} />
                    {a.name}
                  </label>
                ))}
              </div>
            )}
            {scope === "entire_subscription" && (
              <p style={{ fontSize: 11.5, color: "#888", margin: "6px 0 0" }}>
                Includes extra provider seats and every eligible add-on: {addons.map((a) => a.name).join(", ") || "(no add-ons configured)"}.
              </p>
            )}
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end", marginBottom: 12 }}>
        <div>
          <label style={label_}>Promo code (optional — leave blank to apply automatically)</label>
          <input placeholder="e.g. INTRO20" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={input} />
        </div>
        {durationType !== "until_date" && (
          <div>
            <label style={label_}>Also expires on (optional)</label>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={input} />
          </div>
        )}
        <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, paddingBottom: 10 }}>
          <input type="checkbox" checked={requiresCode} onChange={(e) => setRequiresCode(e.target.checked)} disabled={!code.trim()} />
          Require the code (don't apply automatically)
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
        <button type="submit" disabled={pending} style={submitBtn}>
          {pending ? "Creating..." : "Create promotion"}
        </button>
        {message && <span style={{ fontSize: 13, color: message.startsWith("Error") ? "crimson" : "#1a7f37" }}>{message}</span>}
      </div>
    </form>
  );
}

const input: React.CSSProperties = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" };
const label_: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 };
const chip: React.CSSProperties = { padding: "6px 12px", borderRadius: 999, border: "1px solid #ddd", fontSize: 13, cursor: "pointer" };
const submitBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
