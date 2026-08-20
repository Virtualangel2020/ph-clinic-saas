"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setTenantPlanAction,
  setTenantAddonAction,
  setTenantStatusAction,
  setTenantDiscountAction,
  setTenantTestFlagAction,
  setTenantProviderSeatsAction,
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
  activeDiscount,
}: {
  tenant: any;
  plans: Plan[];
  addons: Addon[];
  activeAddonIds: string[];
  activeDiscount: { id: string; discount_percent: number; note: string | null; created_at: string } | null;
}) {
  const router = useRouter();
  const sub = tenant.subscriptions?.[0];
  const [planId, setPlanId] = useState(sub?.plan_id ?? plans[0]?.id ?? "");
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]>((sub?.billing_cycle as any) ?? "monthly");
  const [status, setStatus] = useState(sub?.status ?? "active");
  const [activeAddons, setActiveAddons] = useState<Set<string>>(new Set(activeAddonIds));
  const [discountPercent, setDiscountPercent] = useState(activeDiscount?.discount_percent?.toString() ?? "");
  const [discountNote, setDiscountNote] = useState("");
  const [isTest, setIsTest] = useState<boolean>(!!tenant.is_test);
  const [providerSeats, setProviderSeats] = useState<string>((sub?.provider_seats ?? 1).toString());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggleTest(next: boolean) {
    setIsTest(next);
    startTransition(async () => {
      try {
        await setTenantTestFlagAction(tenant.id, next);
        setMessage(next ? "Marked as a test client." : "Unmarked as a test client.");
      } catch (e: any) {
        setIsTest(!next);
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  function saveDiscount() {
    const value = discountPercent.trim() === "" ? null : Number(discountPercent);
    if (value !== null && (isNaN(value) || value <= 0 || value > 100)) {
      setMessage("Error: discount must be a number between 1 and 100.");
      return;
    }
    applyDiscount(value);
  }

  function removeDiscount() {
    setDiscountPercent("");
    applyDiscount(null);
  }

  function applyDiscount(value: number | null, noteOverride?: string) {
    startTransition(async () => {
      try {
        await setTenantDiscountAction(tenant.id, value, noteOverride ?? discountNote);
        setMessage(value ? `Discount of ${value}% applied.` : "Discount removed.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

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

  // Covers tenants that ended up with no subscriptions row at all — created
  // directly (not through the request/checkout flow), or left behind by a
  // webhook that never finished. admin_set_tenant_plan is an upsert (see
  // migration 028_admin_advanced_controls), so this same call both creates
  // and edits a subscription; router.refresh() re-renders the page once the
  // row exists so the full editor below takes over.
  function createSubscription(complimentary: boolean) {
    startTransition(async () => {
      try {
        await setTenantPlanAction(tenant.id, planId, cycle);
        if (complimentary) {
          await setTenantDiscountAction(tenant.id, 100, "Complimentary account — no charge");
        }
        setMessage(complimentary ? "Subscription created — this client is complimentary (free)." : "Subscription created.");
        router.refresh();
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  function saveProviderSeats() {
    const value = Number(providerSeats);
    if (isNaN(value) || value < 1) {
      setMessage("Error: provider seats must be a whole number of at least 1.");
      return;
    }
    startTransition(async () => {
      try {
        await setTenantProviderSeatsAction(tenant.id, value);
        setMessage(`Provider seats set to ${value}.`);
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
      <div style={{ display: "grid", gap: 16 }}>
        {message && (
          <div style={{ fontSize: 13, color: pending ? "#888" : "#2563eb" }}>{pending ? "Saving..." : message}</div>
        )}
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>No subscription yet</h2>
          <p style={{ fontSize: 13, color: "#7a5c12", marginBottom: 16 }}>
            This tenant was created without a plan attached — e.g. set up directly instead of through checkout, or a
            payment that was interrupted before provisioning finished. Pick a plan below to activate it. You can
            also make it complimentary if this client shouldn't be charged.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={selectStyle} disabled={pending}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select value={cycle} onChange={(e) => setCycle(e.target.value as any)} style={selectStyle} disabled={pending}>
              {CYCLES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: "#666" }}>
              {priceFor(plans.find((p) => p.id === planId)?.plan_prices ?? [], cycle)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => createSubscription(false)} disabled={pending || !planId} style={buttonStyle}>
              Create subscription
            </button>
            <button
              onClick={() => createSubscription(true)}
              disabled={pending || !planId}
              style={{ ...buttonStyle, background: "#0c1730", color: "#e6c66b" }}
            >
              Create as complimentary (free)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {message && (
        <div style={{ fontSize: 13, color: pending ? "#888" : "#2563eb" }}>{pending ? "Saving..." : message}</div>
      )}

      {isTest && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 12, padding: "10px 16px", fontSize: 13, color: "#7a5c12" }}>
          🧪 This is a <strong>test client</strong>. It behaves like a normal client everywhere, but its payments
          auto-complete without charging anything, and it's excluded from the platform's totals and reports.
        </div>
      )}

      <Card title="Test client">
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={isTest} disabled={pending} onChange={(e) => toggleTest(e.target.checked)} />
          Mark as a test client
        </label>
        <p style={{ fontSize: 12, color: "#888", marginTop: 8, marginBottom: 0 }}>
          Everything works normally for this client — signup, plan/add-on changes, invoices — except its payment
          step auto-completes instead of charging a real card/GCash, and it's left out of every count, total, and
          report everyone else sees. Its own data still shows here, individually, exactly like any other client.
        </p>
      </Card>

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

      <Card title="Clinical provider seats">
        <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
          How many staff can hold the "doctor" role and sign notes/prescriptions. Overrides here bypass this
          tenant's plan-included seat count and any purchased add-on seats — use it for one-off arrangements.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="number"
            min={1}
            value={providerSeats}
            onChange={(e) => setProviderSeats(e.target.value)}
            style={{ ...selectStyle, width: 90 }}
          />
          <button onClick={saveProviderSeats} disabled={pending} style={buttonStyle}>Save seats</button>
        </div>
      </Card>

      <Card title="Discount for this client">
        {activeDiscount && (
          <div style={{ fontSize: 12, color: "#1a7f37", marginBottom: 10 }}>
            Currently getting <strong>{activeDiscount.discount_percent}% off</strong>
            {activeDiscount.note ? ` — ${activeDiscount.note}` : ""} (since{" "}
            {new Date(activeDiscount.created_at).toLocaleDateString()})
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="number"
            min={1}
            max={100}
            placeholder="e.g. 20"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            style={{ ...selectStyle, width: 90 }}
          />
          <span style={{ fontSize: 13, color: "#666" }}>% off, of the regular plan + add-on price</span>
        </div>
        <input
          placeholder="Note (optional) — e.g. loyalty discount, referral"
          value={discountNote}
          onChange={(e) => setDiscountNote(e.target.value)}
          style={{ ...selectStyle, width: "100%", marginTop: 10, boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={saveDiscount} disabled={pending} style={buttonStyle}>
            {activeDiscount ? "Update discount" : "Apply discount"}
          </button>
          {activeDiscount && (
            <button onClick={removeDiscount} disabled={pending} style={{ ...buttonStyle, background: "#a12a2a" }}>
              Remove discount
            </button>
          )}
          {activeDiscount?.discount_percent !== 100 && (
            <button
              onClick={() => {
                const note = discountNote || "Complimentary account — no charge";
                setDiscountPercent("100");
                setDiscountNote(note);
                applyDiscount(100, note);
              }}
              disabled={pending}
              style={{ ...buttonStyle, background: "#0c1730", color: "#e6c66b" }}
            >
              Make this client free (100% off)
            </button>
          )}
        </div>
        {activeDiscount?.discount_percent === 100 && (
          <p style={{ fontSize: 12, color: "#1a7f37", marginTop: 8, marginBottom: 0 }}>
            This client is complimentary — invoices generate at ₱0.
          </p>
        )}
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
