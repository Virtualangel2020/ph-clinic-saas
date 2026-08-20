"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Plan = { id: string; name: string; slug: string; description: string | null; plan_prices: { billing_cycle: string; price_php: number }[] };
type Addon = { id: string; name: string; slug: string; addon_prices: { billing_cycle: string; price_php: number }[] };
type Promotion = {
  id: string;
  code: string | null;
  label: string;
  discount_percent: number;
  applies_to_plan_id: string | null;
};

const CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "Lifetime" },
] as const;

function priceFor(prices: { billing_cycle: string; price_php: number }[], cycle: string) {
  const p = prices.find((x) => x.billing_cycle === cycle);
  return p ? Number(p.price_php) : 0;
}

// The automatic promo is whichever code-less promotion is currently active
// and either applies to every plan or to the one currently selected — it's
// applied without the visitor needing to type anything in.
function findAutoPromo(promotions: Promotion[], planId: string) {
  return (
    promotions.find(
      (p) => !p.code && (p.applies_to_plan_id === null || p.applies_to_plan_id === planId)
    ) ?? null
  );
}

export function RequestAccessForm({
  plans,
  addons,
  promotions = [],
  selection = null,
}: {
  plans: Plan[];
  addons: Addon[];
  promotions?: Promotion[];
  // Set by the pricing cards above when someone clicks "Request this
  // plan" — preselects that plan and whichever billing cycle they were
  // previewing. `token` increments on every click so the effect below
  // fires even if they click the same plan/cycle combo twice in a row.
  selection?: { planId: string; cycle: (typeof CYCLES)[number]["value"]; token: number } | null;
}) {
  const [clinicName, setClinicName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]["value"]>("monthly");

  useEffect(() => {
    if (!selection) return;
    setPlanId(selection.planId);
    setCycle(selection.cycle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.token]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [promoCode, setPromoCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const plan = plans.find((p) => p.id === planId);
  const planPrice = plan ? priceFor(plan.plan_prices, cycle) : 0;
  const addonsTotal = addons
    .filter((a) => selectedAddons.has(a.id))
    .reduce((sum, a) => sum + priceFor(a.addon_prices, cycle), 0);
  const subtotal = planPrice + addonsTotal;

  const codedPromo = promoCode.trim()
    ? promotions.find((p) => p.code?.toUpperCase() === promoCode.trim().toUpperCase()) ?? null
    : null;
  const activePromo = codedPromo ?? findAutoPromo(promotions, planId);
  const discountAmount = activePromo ? Math.round(subtotal * (activePromo.discount_percent / 100)) : 0;
  const total = subtotal - discountAmount;

  function toggleAddon(id: string) {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.from("requests").insert({
      type: "new_signup",
      clinic_name: clinicName,
      contact_name: contactName,
      contact_email: email,
      contact_phone: phone || null,
      requested_plan_id: planId || null,
      requested_billing_cycle: cycle,
      requested_addon_ids: Array.from(selectedAddons),
      promotion_id: activePromo?.id ?? null,
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div style={{ background: "#f0f9f0", border: "1px solid #bfe3bf", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Request received</h2>
        <p style={{ color: "#333", fontSize: 14 }}>
          Thanks — your request has been sent to the Angel Clinic team for review. Nothing is provisioned
          automatically; we'll reach out at {email} once it's approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Request access</h2>

      {activePromo && (
        <div
          style={{
            background: "#fff7e6",
            border: "1px solid #e6c66b",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 16,
            color: "#7a5c12",
          }}
        >
          🎉 {activePromo.label} — <strong>{activePromo.discount_percent}% off</strong> is applied to this request.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
        <input required placeholder="Clinic name" value={clinicName} onChange={(e) => setClinicName(e.target.value)} style={input} />
        <input required placeholder="Your name" value={contactName} onChange={(e) => setContactName(e.target.value)} style={input} />
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
        <input required placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Plan</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {plans.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setPlanId(p.id)}
              style={{
                ...chip,
                borderColor: planId === p.id ? "#2563eb" : "#ddd",
                background: planId === p.id ? "#eff4ff" : "white",
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Billing</label>
        <div style={{ display: "flex", gap: 8 }}>
          {CYCLES.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => setCycle(c.value)}
              style={{
                ...chip,
                borderColor: cycle === c.value ? "#2563eb" : "#ddd",
                background: cycle === c.value ? "#eff4ff" : "white",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>Add-ons (separate pricing)</label>
        <div style={{ display: "grid", gap: 6 }}>
          {addons.map((a) => (
            <label key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 10px", border: "1px solid #eee", borderRadius: 8 }}>
              <span>
                <input type="checkbox" checked={selectedAddons.has(a.id)} onChange={() => toggleAddon(a.id)} style={{ marginRight: 8 }} />
                {a.name}
              </span>
              <span style={{ color: "#888" }}>₱{priceFor(a.addon_prices, cycle).toLocaleString()} / {cycle}</span>
            </label>
          ))}
        </div>
      </div>

      {promotions.some((p) => p.code) && (
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Promo code (optional)</label>
          <input
            placeholder="Have a code? Enter it here"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            style={{ ...input, width: "100%", boxSizing: "border-box" }}
          />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #eee" }}>
        <div style={{ fontSize: 14 }}>
          {activePromo ? (
            <>
              <span style={{ textDecoration: "line-through", color: "#999", marginRight: 8 }}>
                ₱{subtotal.toLocaleString()}
              </span>
              Estimated total: <strong>₱{total.toLocaleString()}</strong> / {cycle}
            </>
          ) : (
            <>
              Estimated total: <strong>₱{total.toLocaleString()}</strong> / {cycle}
            </>
          )}
        </div>
        <button type="submit" disabled={status === "submitting"} style={submitBtn}>
          {status === "submitting" ? "Sending..." : "Send request"}
        </button>
      </div>
      {status === "error" && <p style={{ color: "crimson", fontSize: 13, marginTop: 8 }}>{errorMsg}</p>}
      <p style={{ fontSize: 11, color: "#999", marginTop: 10 }}>
        This is a request, not a purchase — nothing is charged or provisioned automatically. The Angel Clinic team
        reviews every request before setting up an account.
      </p>
    </form>
  );
}

const input: React.CSSProperties = { padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 };
const chip: React.CSSProperties = { padding: "6px 12px", borderRadius: 999, border: "1px solid #ddd", fontSize: 13, cursor: "pointer" };
const submitBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};
