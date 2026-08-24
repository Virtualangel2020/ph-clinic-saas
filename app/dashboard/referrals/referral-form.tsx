"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createReferralAction } from "./actions";
import { searchAngelClinicProvidersAction, searchExternalProvidersAction, type DirectoryProvider, type ExternalDirectoryProvider } from "../patients/care-coordination-actions";

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 4 };

// The one referral-creation form — used identically from the patient
// chart's Referrals tab (patient pre-selected) and from the global "+ New
// Referral" flow (patient chosen via search first, see referrals/new/).
// Same createReferralAction either way, so a referral placed from either
// entry point lands in the exact same `referrals` row.
export function ReferralForm({ patientId, onDone }: { patientId: string; onDone?: () => void }) {
  const [destinationType, setDestinationType] = useState<"internal" | "external">("internal");
  const [providerQuery, setProviderQuery] = useState("");
  const [internalResults, setInternalResults] = useState<DirectoryProvider[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalDirectoryProvider[]>([]);
  const [selectedInternal, setSelectedInternal] = useState<DirectoryProvider | null>(null);
  const [selectedExternal, setSelectedExternal] = useState<ExternalDirectoryProvider | null>(null);
  const [externalDestinationName, setExternalDestinationName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [urgency, setUrgency] = useState<"routine" | "urgent">("routine");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (providerQuery.trim().length < 2) {
      setInternalResults([]);
      setExternalResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      if (destinationType === "internal") setInternalResults(await searchAngelClinicProvidersAction(providerQuery));
      else setExternalResults(await searchExternalProvidersAction(providerQuery));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [providerQuery, destinationType]);

  function pickInternal(p: DirectoryProvider) {
    setSelectedInternal(p);
    setProviderQuery("");
    setInternalResults([]);
    if (!specialty && p.specialty) setSpecialty(p.specialty);
  }
  function pickExternal(p: ExternalDirectoryProvider) {
    setSelectedExternal(p);
    setProviderQuery("");
    setExternalResults([]);
    if (!specialty && p.specialty) setSpecialty(p.specialty);
  }

  function save() {
    if (!reason.trim()) {
      setError("A reason for referral is required.");
      return;
    }
    if (destinationType === "internal" && !selectedInternal) {
      setError("Choose a receiving AngelClinic provider.");
      return;
    }
    if (destinationType === "external" && !selectedExternal && !externalDestinationName.trim()) {
      setError("Choose an external provider or enter a destination name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createReferralAction({
          patientId,
          destinationType,
          receivingProviderId: selectedInternal?.id ?? null,
          externalProviderId: selectedExternal?.id ?? null,
          externalDestinationName,
          specialtyRequested: specialty,
          reason,
          clinicalSummary,
          urgency,
        });
        setSuccess(true);
        setSelectedInternal(null);
        setSelectedExternal(null);
        setExternalDestinationName("");
        setSpecialty("");
        setReason("");
        setClinicalSummary("");
        setUrgency("routine");
        onDone?.();
      } catch (e: any) {
        setError(e.message || "Couldn't create that referral.");
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 14, display: "grid", gap: 10 }}>
      {success && <p style={{ fontSize: 12.5, color: "#1a7f37", margin: 0 }}>Referral created.</p>}

      <div style={{ display: "flex", gap: 14, fontSize: 12.5 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <input
            type="radio"
            checked={destinationType === "internal"}
            onChange={() => {
              setDestinationType("internal");
              setSelectedExternal(null);
              setInternalResults([]);
              setProviderQuery("");
            }}
          />
          AngelClinic provider
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <input
            type="radio"
            checked={destinationType === "external"}
            onChange={() => {
              setDestinationType("external");
              setSelectedInternal(null);
              setExternalResults([]);
              setProviderQuery("");
            }}
          />
          External (outside AngelClinic)
        </label>
      </div>

      <div>
        <div style={labelStyle}>{destinationType === "internal" ? "Receiving Provider" : "External Provider / Clinic"}</div>
        {destinationType === "internal" && selectedInternal ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ fontSize: 13 }}>
              {selectedInternal.title ? `${selectedInternal.title} ` : ""}
              {selectedInternal.full_name}
              <span style={{ color: "#888", marginLeft: 6, fontSize: 12 }}>
                {selectedInternal.specialty ?? ""} {selectedInternal.clinic_name ? `· ${selectedInternal.clinic_name}` : ""}
              </span>
            </span>
            <button onClick={() => setSelectedInternal(null)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
              Change
            </button>
          </div>
        ) : destinationType === "external" && selectedExternal ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ fontSize: 13 }}>
              {selectedExternal.full_name}
              <span style={{ color: "#888", marginLeft: 6, fontSize: 12 }}>
                {selectedExternal.specialty ?? ""} {selectedExternal.clinic_name ? `· ${selectedExternal.clinic_name}` : ""}
              </span>
            </span>
            <button onClick={() => setSelectedExternal(null)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              placeholder={destinationType === "internal" ? "Search by name, specialty, or clinic…" : "Search the external provider directory…"}
              value={providerQuery}
              onChange={(e) => setProviderQuery(e.target.value)}
              style={FIELD_STYLE}
            />
            {destinationType === "internal" && internalResults.length > 0 && (
              <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                {internalResults.map((p) => (
                  <button key={p.id} onClick={() => pickInternal(p)} style={resultRowStyle}>
                    {p.title ? `${p.title} ` : ""}
                    {p.full_name} <span style={{ color: "#888" }}>· {p.specialty ?? "—"} {p.clinic_name ? `· ${p.clinic_name}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
            {destinationType === "external" && externalResults.length > 0 && (
              <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                {externalResults.map((p) => (
                  <button key={p.id} onClick={() => pickExternal(p)} style={resultRowStyle}>
                    {p.full_name} <span style={{ color: "#888" }}>· {p.specialty ?? "—"} {p.clinic_name ? `· ${p.clinic_name}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
            {destinationType === "external" && (
              <input
                placeholder="Not in the directory? Type a destination name (e.g. Dr. Cruz, St. Luke's Medical Center)"
                value={externalDestinationName}
                onChange={(e) => setExternalDestinationName(e.target.value)}
                style={{ ...FIELD_STYLE, marginTop: 6 }}
              />
            )}
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div>
          <div style={labelStyle}>Specialty Requested</div>
          <input placeholder="e.g. Cardiology" value={specialty} onChange={(e) => setSpecialty(e.target.value)} style={FIELD_STYLE} />
        </div>
        <div>
          <div style={labelStyle}>Urgency</div>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value as "routine" | "urgent")} style={FIELD_STYLE}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <div style={labelStyle}>Reason for Referral *</div>
        <textarea placeholder="Why is this patient being referred?" value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...FIELD_STYLE, minHeight: 50 }} />
      </div>

      <div>
        <div style={labelStyle}>Relevant Clinical Summary (optional)</div>
        <textarea placeholder="Brief history relevant to this referral" value={clinicalSummary} onChange={(e) => setClinicalSummary(e.target.value)} style={{ ...FIELD_STYLE, minHeight: 50 }} />
      </div>

      {error && <p style={{ fontSize: 12, color: "#a12a2a", margin: 0 }}>{error}</p>}
      <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
        {pending ? "Creating…" : "Create Referral"}
      </button>
    </div>
  );
}

const resultRowStyle: React.CSSProperties = { textAlign: "left", background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, cursor: "pointer" };
