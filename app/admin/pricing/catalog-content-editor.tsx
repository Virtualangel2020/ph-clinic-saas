"use client";

import { useState, useTransition } from "react";
import { setPlanContentAction, setAddonContentAction, setFeatureDescriptionAction } from "@/app/admin/actions";

type Plan = { id: string; name: string; tagline: string | null; description: string | null; is_active?: boolean };
type Addon = { id: string; name: string; description: string | null; recommended_for: string | null; is_active?: boolean };

function InactiveBadge() {
  return (
    <span
      style={{
        marginLeft: 8,
        fontSize: 10,
        fontWeight: 700,
        color: "#a12a2a",
        background: "#fff0f0",
        border: "1px solid #f3c6c6",
        borderRadius: 4,
        padding: "1px 6px",
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      Inactive
    </span>
  );
}
type Feature = { feature_key: string; label: string; description: string | null };

// Every field here is what the public pricing page and the "View
// Details"/comparison-table redesign (next phase) will read from — this
// is the no-code control surface so Angel never needs a developer to
// change what customers see when a package/feature/add-on's copy changes.

export function PlanContentEditor({ plans }: { plans: Plan[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {plans.map((p) => (
        <PlanRow key={p.id} plan={p} />
      ))}
    </div>
  );
}

function PlanRow({ plan }: { plan: Plan }) {
  const [tagline, setTagline] = useState(plan.tagline ?? "");
  const [description, setDescription] = useState(plan.description ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setPlanContentAction(plan.id, description, tagline);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14, opacity: plan.is_active === false ? 0.6 : 1 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
        {plan.name}
        {plan.is_active === false && <InactiveBadge />}
      </div>
      <input
        placeholder='Tagline — e.g. "Best for small clinics needing the essentials"'
        value={tagline}
        onChange={(e) => setTagline(e.target.value)}
        onBlur={save}
        disabled={pending}
        style={{ ...inputStyle, marginBottom: 8 }}
      />
      <textarea
        placeholder="Longer description shown when a customer expands this plan"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={save}
        disabled={pending}
        rows={2}
        style={{ ...inputStyle, resize: "vertical" }}
      />
      {saved && <div style={{ fontSize: 11, color: "#1a7f37", marginTop: 4 }}>saved</div>}
      {error && <div style={{ fontSize: 11, color: "crimson", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export function AddonContentEditor({ addons }: { addons: Addon[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {addons.map((a) => (
        <AddonRow key={a.id} addon={a} />
      ))}
    </div>
  );
}

function AddonRow({ addon }: { addon: Addon }) {
  const [description, setDescription] = useState(addon.description ?? "");
  const [recommendedFor, setRecommendedFor] = useState(addon.recommended_for ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setAddonContentAction(addon.id, description, recommendedFor);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14, opacity: addon.is_active === false ? 0.6 : 1 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
        {addon.name}
        {addon.is_active === false && <InactiveBadge />}
      </div>
      <textarea
        placeholder="What this add-on does, in plain language a non-technical clinic owner would understand"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={save}
        disabled={pending}
        rows={2}
        style={{ ...inputStyle, marginBottom: 8, resize: "vertical" }}
      />
      <input
        placeholder='Recommended for — e.g. "Clinics wanting patients to access information online"'
        value={recommendedFor}
        onChange={(e) => setRecommendedFor(e.target.value)}
        onBlur={save}
        disabled={pending}
        style={inputStyle}
      />
      {saved && <div style={{ fontSize: 11, color: "#1a7f37", marginTop: 4 }}>saved</div>}
      {error && <div style={{ fontSize: 11, color: "crimson", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export function FeatureDescriptionEditor({ features }: { features: Feature[] }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {features.map((f) => (
        <FeatureRow key={f.feature_key} feature={f} />
      ))}
    </div>
  );
}

function FeatureRow({ feature }: { feature: Feature }) {
  const [description, setDescription] = useState(feature.description ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setFeatureDescriptionAction(feature.feature_key, description);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 10, alignItems: "start", background: "white", border: "1px solid #eee", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontWeight: 600, fontSize: 13, paddingTop: 8 }}>{feature.label}</div>
      <textarea
        placeholder="Plain-language explanation shown under this feature on the pricing page"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={save}
        disabled={pending}
        rows={1}
        style={inputStyle}
      />
      <div style={{ fontSize: 11, paddingTop: 8, minWidth: 40 }}>
        {saved && <span style={{ color: "#1a7f37" }}>saved</span>}
        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 13,
  fontFamily: "inherit",
};
