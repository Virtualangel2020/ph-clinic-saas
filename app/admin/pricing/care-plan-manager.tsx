"use client";

import { useState, useTransition } from "react";
import { upsertCarePlanAction, setCarePlanActiveAction } from "@/app/admin/actions";

const KINDS = [
  { value: "monthly_care", label: "Monthly Care" },
  { value: "annual_care", label: "Annual Care" },
  { value: "hosting_only", label: "Hosting Only" },
  { value: "self_managed", label: "Self-Managed" },
] as const;

type CarePlan = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  price_php: number | null;
  billing_cycle: string | null;
  includes_support: boolean;
  includes_feature_updates: boolean;
  requires_approval: boolean;
  is_active: boolean;
  description: string | null;
};

export function CarePlanManager({ carePlans }: { carePlans: CarePlan[] }) {
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {carePlans.map((cp) => (
        <CarePlanRow key={cp.id} carePlan={cp} />
      ))}

      {showNewForm ? (
        <CarePlanForm
          onDone={() => setShowNewForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          style={{ alignSelf: "flex-start", padding: "8px 14px", borderRadius: 8, border: "1px dashed #999", background: "white", fontSize: 13, cursor: "pointer" }}
        >
          + Add a care plan
        </button>
      )}
    </div>
  );
}

function CarePlanRow({ carePlan }: { carePlan: CarePlan }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(carePlan.is_active);

  function toggleActive() {
    const next = !isActive;
    setIsActive(next);
    startTransition(async () => {
      await setCarePlanActiveAction(carePlan.id, next);
    });
  }

  if (editing) {
    return <CarePlanForm existing={carePlan} onDone={() => setEditing(false)} />;
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {carePlan.name}
          {!isActive && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "#888", border: "1px solid #ccc", borderRadius: 999, padding: "2px 8px" }}>
              off
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
          {carePlan.price_php !== null ? `₱${Number(carePlan.price_php).toLocaleString()} / ${carePlan.billing_cycle}` : "Price set per agreement"}
          {carePlan.requires_approval ? " · requires approval" : ""}
        </div>
        {carePlan.description && <div style={{ fontSize: 12, color: "#666", marginTop: 6, maxWidth: 520 }}>{carePlan.description}</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setEditing(true)} style={smallBtn}>Edit</button>
        <button onClick={toggleActive} disabled={pending} style={{ ...smallBtn, background: isActive ? "#a12a2a" : "#1a7f37" }}>
          {isActive ? "Turn off" : "Turn on"}
        </button>
      </div>
    </div>
  );
}

function CarePlanForm({ existing, onDone }: { existing?: CarePlan; onDone: () => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [kind, setKind] = useState(existing?.kind ?? "monthly_care");
  const [price, setPrice] = useState(existing?.price_php !== null && existing?.price_php !== undefined ? String(existing.price_php) : "");
  const [billingCycle, setBillingCycle] = useState(existing?.billing_cycle ?? "monthly");
  const [includesSupport, setIncludesSupport] = useState(existing?.includes_support ?? true);
  const [includesFeatureUpdates, setIncludesFeatureUpdates] = useState(existing?.includes_feature_updates ?? false);
  const [requiresApproval, setRequiresApproval] = useState(existing?.requires_approval ?? false);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertCarePlanAction({
          id: existing?.id ?? null,
          slug: slug.trim(),
          name: name.trim(),
          kind,
          pricePhp: price.trim() === "" ? null : Number(price),
          billingCycle: kind === "self_managed" ? null : billingCycle,
          includesSupport,
          includesFeatureUpdates,
          requiresApproval,
          description,
        });
        onDone();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #2563eb", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={input} />
        <input
          placeholder="slug (e.g. monthly-care)"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
          style={input}
          disabled={!!existing}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </div>

      {kind !== "self_managed" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <input type="number" min={0} placeholder="Price (₱)" value={price} onChange={(e) => setPrice(e.target.value)} style={input} />
          <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)} style={input}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      )}

      <textarea
        placeholder="What's included..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ ...input, width: "100%", minHeight: 60, marginBottom: 10, boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={includesSupport} onChange={(e) => setIncludesSupport(e.target.checked)} /> Includes support
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={includesFeatureUpdates} onChange={(e) => setIncludesFeatureUpdates(e.target.checked)} /> Includes feature updates
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} /> Requires approval
        </label>
      </div>

      {error && <div style={{ color: "crimson", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={pending} style={{ ...smallBtn, background: "#2563eb" }}>
          {pending ? "Saving..." : "Save"}
        </button>
        <button onClick={onDone} style={{ ...smallBtn, background: "#888" }}>Cancel</button>
      </div>
    </div>
  );
}

const input: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
const smallBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  color: "white",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};
