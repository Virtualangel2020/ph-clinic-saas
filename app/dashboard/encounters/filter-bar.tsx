"use client";

import { useRouter } from "next/navigation";

type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string };

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontFamily: "inherit" };

// Optional, non-mandatory filters on top of the date view (spec §19) — the
// date stays primary; these just narrow what's shown for that date.
export function FilterBar({
  date,
  providerId,
  encounterType,
  status,
  providers,
  appointmentTypes,
}: {
  date: string;
  providerId: string;
  encounterType: string;
  status: string;
  providers: Provider[];
  appointmentTypes: ApptType[];
}) {
  const router = useRouter();

  function update(next: Partial<{ provider: string; type: string; status: string }>) {
    const params = new URLSearchParams();
    params.set("date", date);
    const provider = next.provider ?? providerId;
    const type = next.type ?? encounterType;
    const st = next.status ?? status;
    if (provider) params.set("provider", provider);
    if (type) params.set("type", type);
    if (st) params.set("status", st);
    router.push(`/dashboard/encounters?${params.toString()}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <select value={providerId} onChange={(e) => update({ provider: e.target.value })} style={FIELD_STYLE}>
        <option value="">All providers</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title ? `${p.title} ` : ""}
            {p.full_name}
          </option>
        ))}
      </select>
      <select value={encounterType} onChange={(e) => update({ type: e.target.value })} style={FIELD_STYLE}>
        <option value="">All types</option>
        {appointmentTypes.map((t) => (
          <option key={t.id} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
      <select value={status} onChange={(e) => update({ status: e.target.value })} style={FIELD_STYLE}>
        <option value="">Any status</option>
        <option value="open">Open</option>
        <option value="closed">Closed / Completed</option>
      </select>
      {(providerId || encounterType || status) && (
        <button onClick={() => update({ provider: "", type: "", status: "" })} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer" }}>
          Clear filters
        </button>
      )}
    </div>
  );
}
