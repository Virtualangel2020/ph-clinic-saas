"use client";

import { useState, useTransition } from "react";
import {
  setTenantPlanAction,
  setTenantAddonAction,
  setTenantStatusAction,
} from "@/app/admin/actions";

type Plan = { id: string; name: string; slug: string; plan_prices: { billing_cycle: string; price_php: number }[] };
type Addon = { id: string; name: string; slug: string; feature_key: string; addon_prices: { billing_cycle: string; price_php: number }[] };

const STATUSES = ["pending", "trial", "active", "past_due", "grace_period", "suspended", "cancelled", "expired"];
const CYCLES = ["monthly", "yearly", "one_time"] as const;

function priceFor(prices: { billing_cycle: string; price_php: number }[], cycle: string) {
  const p = prices.find((x) => x.billing_cycle === cycle);
  return p ? `₱${Number(p.price_php).toLocaleString()}` : "—";
}

export function ClientEditor({
  tenant,
  plans,
  addons,
  activeAddonIds,
}: {
  tenant: any;
  plans: Plan[];
  addons: Addon[];
  activeAddonIds: string[];
}) {
  const sub = tenant.subscriptions?.[0];
  const [planId, setPlanId] = useState(sub?.plan_id ?? plans[0]?.id ?? "");
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]>((sub?.billing_cycle as any) ?? "monthly");
  const [status, setStatus] = useState(sub?.status ?? "active");
  const [activeAddons, setActiveAddons] = useState<Set<string>>(new Set(activeAddonIds));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function savePlan() {
    startTransition(async () => {
      try {
        await setTenantPlanAction(tenant.id, planId, cycle);
        setMessage("Plan updated.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  function saveStatus(newStatus: string) {
    setStatus(newStatus);
    startTransition(async () => {
      try {
        await setTenantStatusAction(tenant.id, newStatus);
        setMessage("Status updated.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  function toggleAddon(addonId: string, enabled: boolean) {
    setActiveAddons((prev) => {
      const next = new Set(prev);
      enabled ? next.add(addonId) : next.delete(addonId);
      return next;
    });
    startTransition(async () => {
      try {
        await setTenantAddonAction(tenant.id, addonId, enabled);
        setMessage(`${enabled ? "Enabled" : "Disabled"} add-on.`);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  if (!sub) {
    return (
      <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 12, padding: 20 }}>
        This tenant has no subscription record yet (it was likely created outside the request-approval flow).
        Plan/add-on management needs a subscription row first.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {message && (
        <div style={{ fontSize: 13, color: pending ? "#888" : "#2563eb" }}>{pending ? "Saving..." : message}</div>
      )}

      <Card title="Plan & billing">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={selectStyle}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select value={cycle} onChange={(e) => setCycle(e.target.value as any)} style={selectStyle}>
            {CYCLES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: "#666" }}>
            {priceFor(plans.find((p) => p.id === planId)?.plan_prices ?? [], cycle)}
          </span>
          <button onClick={savePlan} disabled={pending} style={buttonStyle}>Save plan</button>
        </div>
      </Card>

      <Card title="Subscription status">
        <select value={status} onChange={(e) => saveStatus(e.target.value)} style={selectStyle} disabled={pending}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Card>

      <Card title="Add-ons (individually toggled for this client)">
        <div style={{ display: "grid", gap: 8 }}>
          {addons.map((a) => {
            const isOn = activeAddons.has(a.id);
            return (
              <label
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={pending}
                    onChange={(e) => toggleAddon(a.id, e.target.checked)}
                  />
                  {a.name}
                </span>
                <span style={{ color: "#888" }}>{priceFor(a.addon_prices, cycle)} / {cycle}</span>
              </label>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
