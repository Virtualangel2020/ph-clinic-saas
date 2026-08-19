"use client";

import { useState } from "react";
import Link from "next/link";

type PlanPrice = { billing_cycle: string; price_php: number };
type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  plan_prices: PlanPrice[];
  plan_features?: { feature_key: string; features: { label: string } | null }[];
};
type Addon = { id: string; name: string; slug: string; addon_prices: PlanPrice[] };
type Promotion = {
  id: string;
  code: string | null;
  label: string;
  discount_percent: number;
  applies_to_plan_id: string | null;
};

const CYCLES = [
  { value: "monthly", label: "Monthly", suffix: "/mo" },
  { value: "yearly", label: "Yearly", suffix: "/yr" },
  { value: "one_time", label: "Lifetime", suffix: " one-time" },
] as const;

type Cycle = (typeof CYCLES)[number]["value"];

function priceFor(prices: PlanPrice[] | undefined, cycle: string) {
  const p = prices?.find((x) => x.billing_cycle === cycle);
  return p ? Number(p.price_php) : null;
}

export function PricingSection({
  plans,
  addons,
  promotions = [],
}: {
  plans: Plan[];
  addons: Addon[];
  promotions?: Promotion[];
}) {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>
          Plans (regular pricing)
        </h2>
        <div style={{ display: "inline-flex", background: "#eef0f3", borderRadius: 999, padding: 4 }}>
          {CYCLES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCycle(c.value)}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: cycle === c.value ? "#0c1730" : "transparent",
                color: cycle === c.value ? "#e6c66b" : "#555",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {cycle === "one_time" && (
        <p style={{ color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "8px 14px", fontSize: 12, marginTop: 0, marginBottom: 16 }}>
          Lifetime access is a single one-time payment — no more monthly or yearly billing for the software itself.
          Hosting/maintenance after the included warranty is a separate, much smaller optional care plan.
        </p>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 32 }}>
        {plans.map((plan) => {
          const price = priceFor(plan.plan_prices, cycle);
          const promo = promotions.find(
            (p) => !p.code && (p.applies_to_plan_id === null || p.applies_to_plan_id === plan.id)
          );
          const discounted = price !== null && promo ? price * (1 - promo.discount_percent / 100) : null;
          const cycleMeta = CYCLES.find((c) => c.value === cycle)!;

          return (
            <div key={plan.slug} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20, position: "relative", display: "flex", flexDirection: "column" }}>
              {promo && (
                <div style={{ position: "absolute", top: -10, right: 14, background: "#e6c66b", color: "#0c1730", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                  {promo.discount_percent}% OFF
                </div>
              )}
              <h3 style={{ fontSize: 18, marginTop: 0, marginBottom: 4 }}>{plan.name}</h3>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 10, minHeight: 20 }}>
                {price === null ? (
                  <span style={{ color: "#aaa" }}>Not offered on {cycleMeta.label.toLowerCase()}</span>
                ) : discounted !== null ? (
                  <>
                    <span style={{ textDecoration: "line-through", color: "#bbb", marginRight: 6 }}>
                      ₱{price.toLocaleString()}
                    </span>
                    <span style={{ color: "#1a7f37", fontWeight: 700 }}>
                      ₱{Math.round(discounted).toLocaleString()}
                      {cycleMeta.suffix}
                    </span>
                  </>
                ) : (
                  <>
                    ₱{price.toLocaleString()}
                    {cycleMeta.suffix}
                  </>
                )}
              </div>
              <p style={{ color: "#666", fontSize: 13 }}>{plan.description}</p>
              <ul style={{ fontSize: 13, color: "#333", paddingLeft: 18, margin: "0 0 16px" }}>
                {(plan.plan_features ?? []).map((pf) => (
                  <li key={pf.feature_key}>{pf.features?.label}</li>
                ))}
              </ul>
              {price === null ? (
                <button
                  disabled
                  style={{
                    marginTop: "auto",
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#eee",
                    color: "#999",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "not-allowed",
                  }}
                >
                  Get started →
                </button>
              ) : (
                <Link
                  href={`/signup?plan=${plan.id}&cycle=${cycle}`}
                  style={{
                    marginTop: "auto",
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#0c1730",
                    color: "#e6c66b",
                    fontWeight: 700,
                    fontSize: 13,
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Get started →
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
        Add-ons (separate pricing)
      </h2>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 40 }}>
        {addons.map((a) => {
          const price = priceFor(a.addon_prices, cycle);
          const cycleMeta = CYCLES.find((c) => c.value === cycle)!;
          return (
            <div key={a.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ color: "#888" }}>
                {price !== null ? `₱${price.toLocaleString()}${cycleMeta.suffix}` : "not offered this way"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, textAlign: "center" }}>
        <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 6 }}>Ready to get started?</h2>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
          Create your account, pick your plan above, and pay — your clinic's portal unlocks automatically the moment
          payment is received, no waiting on approval.
        </p>
        <Link
          href="/signup"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: 8,
            background: "#0c1730",
            color: "#e6c66b",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Create your account →
        </Link>
      </div>
    </>
  );
}
