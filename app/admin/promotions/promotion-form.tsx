"use client";

import { useState, useTransition } from "react";
import { createPromotionAction } from "@/app/admin/actions";

type Plan = { id: string; name: string };

export function PromotionForm({ plans }: { plans: Plan[] }) {
  const [label, setLabel] = useState("");
  const [discountPercent, setDiscountPercent] = useState("20");
  const [planId, setPlanId] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("3");
  const [endsAt, setEndsAt] = useState("");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const pct = Number(discountPercent);
    if (!label.trim() || isNaN(pct) || pct <= 0 || pct > 100) {
      setMessage("Error: give it a name and a discount between 1 and 100.");
      return;
    }
    startTransition(async () => {
      try {
        await createPromotionAction({
          label: label.trim(),
          discountPercent: pct,
          planId: planId || null,
          maxRedemptions: maxRedemptions.trim() === "" ? null : Number(maxRedemptions),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          code: code.trim() || null,
        });
        setMessage("Promotion created — it's live now.");
        setLabel("");
        setCode("");
      } catch (err: any) {
        setMessage(`Error: ${err.message}`);
      }
    });
  }

  return (
    <form onSubmit={submit} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Create a promotion</h2>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label_}>Name (shown to you internally)</label>
          <input
            required
            placeholder='e.g. "Launch intro price"'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={input}
          />
        </div>
        <div>
          <label style={label_}>Discount %</label>
          <input
            type="number"
            min={1}
            max={100}
            required
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            style={input}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label_}>Applies to</label>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={input}>
            <option value="">All plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} only
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label_}>Stop after this many signups</label>
          <input
            type="number"
            min={1}
            placeholder="Unlimited"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            style={input}
          />
        </div>
        <div>
          <label style={label_}>Or expire on this date</label>
          <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={input} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label_}>Promo code (optional — leave blank to apply automatically to everyone while active)</label>
        <input
          placeholder="e.g. INTRO20"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={input}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
