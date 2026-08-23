"use client";

import { useState, useTransition } from "react";
import { deleteProviderDateAvailabilityAction, setProviderDateAvailabilityAction } from "../actions";

type Provider = { id: string; full_name: string; title: string | null };
type DateAvailRow = { id: string; provider_id: string; avail_date: string; start_time: string; end_time: string; patient_bookable: boolean };

// Spec section 7: some providers don't work the same schedule every week
// and shouldn't be forced into a recurring weekly template just to open a
// few dates. This is a flat add/remove list of one-off date ranges — no
// day-of-week concept at all, purely "this specific date, this window."
export function FlexibleAvailabilityManager({ providers, entries }: { providers: Provider[]; entries: DateAvailRow[] }) {
  const [rows, setRows] = useState(entries);
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [patientBookable, setPatientBookable] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    if (!providerId) return setError("Select a provider.");
    if (!date) return setError("Pick a date.");
    startTransition(async () => {
      try {
        await setProviderDateAvailabilityAction({ id: null, providerId, availDate: date, startTime: start, endTime: end, patientBookable });
        const p = providers.find((p) => p.id === providerId);
        setRows((prev) => [...prev, { id: `pending-${Date.now()}`, provider_id: providerId, avail_date: date, start_time: start, end_time: end, patient_bookable: patientBookable }].sort((a, b) => a.avail_date.localeCompare(b.avail_date)));
        setDate("");
        void p;
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteProviderDateAvailabilityAction(id);
        setRows((prev) => prev.filter((r) => r.id !== id));
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function providerLabel(id: string) {
    const p = providers.find((p) => p.id === id);
    return p ? `${p.title ? p.title + " " : ""}${p.full_name}` : "Unknown";
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 22 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Flexible / one-off availability</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>
        For providers without a fixed weekly schedule — add availability for specific dates as needed, no recurring
        template required. Shown for the next 60 days below; older entries stay in the database but drop off this list.
      </p>

      <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
        {rows.length === 0 ? (
          <p style={{ color: "#aaa", fontSize: 12.5 }}>No flexible availability added yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", border: "1px solid #eee", borderRadius: 8, fontSize: 12.5 }}>
              <div>
                <span style={{ fontWeight: 700 }}>{r.avail_date}</span> · {providerLabel(r.provider_id)} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                {!r.patient_bookable && <span style={{ color: "#999", marginLeft: 6 }}>(internal only)</span>}
              </div>
              <button onClick={() => remove(r.id)} disabled={pending} style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 13 }} title="Remove">
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {providers.length === 0 ? (
        <p style={{ color: "#aaa", fontSize: 12.5 }}>No active doctors yet.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={fieldStyle}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title ? `${p.title} ` : ""}
                {p.full_name}
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} />
          <span style={{ color: "#999" }}>–</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} />
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <input type="checkbox" checked={patientBookable} onChange={(e) => setPatientBookable(e.target.checked)} />
            Patients can book
          </label>
          <button onClick={add} disabled={pending} style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 12, padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer" }}>
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      )}
      {error && <p style={{ color: "crimson", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

const fieldStyle: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px", fontSize: 12.5 };
