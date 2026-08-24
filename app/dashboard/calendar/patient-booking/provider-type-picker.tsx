"use client";

import { useRouter } from "next/navigation";

type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string; default_duration_minutes: number };

// Mirrors the patient portal's own "Select Provider → Select Appointment
// Type" first two steps (spec section 5) — the calendar underneath can
// only be computed once both are known, since the appointment type's
// duration is what slices the day into slots.
export function ProviderTypePicker({
  providers,
  appointmentTypes,
  providerId,
  typeId,
}: {
  providers: Provider[];
  appointmentTypes: ApptType[];
  providerId: string;
  typeId: string;
}) {
  const router = useRouter();

  function go(nextProviderId: string, nextTypeId: string) {
    if (!nextProviderId || !nextTypeId) return;
    router.push(`/dashboard/calendar/patient-booking?providerId=${nextProviderId}&typeId=${nextTypeId}`);
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <div>
        <div style={pickerLabel}>Provider</div>
        <select value={providerId} onChange={(e) => go(e.target.value, typeId)} style={pickerField}>
          <option value="">Select a provider…</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title ? `${p.title} ` : ""}
              {p.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div style={pickerLabel}>Appointment type</div>
        <select value={typeId} onChange={(e) => go(providerId, e.target.value)} style={pickerField}>
          <option value="">Select a type…</option>
          {appointmentTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.default_duration_minutes} min)
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const pickerLabel: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "#666", marginBottom: 4 };
const pickerField: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, minWidth: 220 };
