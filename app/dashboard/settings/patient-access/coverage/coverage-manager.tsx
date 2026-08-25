"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClinicPatientAccessDefaultsAction, setClinicAcceptedHmoAction, setProviderPatientAccessSettingsAction, setProviderHmoAcceptanceAction, revertProviderToClinicDefaultsAction } from "../actions";
import { ClinicPatientAccessRow, ProviderOverrideRow, emptyOverride, isOverrideCustomized, toDefaultsActionInput, toOverrideActionInput } from "../shared";

const VERIFICATION_OPTIONS = [
  { value: "none", label: "No pre-verification needed" },
  { value: "before_confirmation", label: "Verify before confirming the appointment" },
  { value: "before_visit", label: "Verify before the visit" },
  { value: "bring_card_loa", label: "Patient brings HMO card + LOA" },
  { value: "clinic_contacts_patient", label: "Clinic contacts patient to arrange verification" },
];

type Hmo = { id: string; hmo_name: string; is_active: boolean; verification_requirement: string; patient_instructions: string | null; notes: string | null };
type Provider = { id: string; full_name: string; title: string | null };

function cardStyle(): React.CSSProperties {
  return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 20 };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" };
}
function inputStyle(): React.CSSProperties {
  return { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--input-border, #ddd)", fontSize: 13, background: "var(--input-bg, white)", color: "var(--text-heading)" };
}
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-heading)", cursor: disabled ? "default" : "pointer" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function CoverageManager({
  clinicDefaults,
  providers,
  overrides,
  hmos,
  providerHmoLinks,
}: {
  clinicDefaults: ClinicPatientAccessRow;
  providers: Provider[];
  overrides: ProviderOverrideRow[];
  hmos: Hmo[];
  providerHmoLinks: { provider_id: string; hmo_id: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [acceptHmo, setAcceptHmo] = useState(clinicDefaults.accept_hmo);
  const [acceptYakap, setAcceptYakap] = useState(clinicDefaults.accept_yakap);
  const [yakapInstructions, setYakapInstructions] = useState(clinicDefaults.yakap_instructions ?? "");

  function saveDefaults() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setClinicPatientAccessDefaultsAction({
          ...toDefaultsActionInput(clinicDefaults),
          acceptHmo,
          acceptYakap,
          yakapInstructions: yakapInstructions || null,
        });
        setSaved(true);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  return (
    <>
      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 14 }}>Clinic-Wide Default</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <Toggle checked={acceptHmo} onChange={setAcceptHmo} label="Accept HMO Patients" />
          <Toggle checked={acceptYakap} onChange={setAcceptYakap} label="Participate in YAKAP" />
          {acceptYakap && (
            <div>
              <label style={labelStyle()}>YAKAP Instructions for Patients (optional)</label>
              <textarea
                value={yakapInstructions}
                onChange={(e) => setYakapInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. Bring your YAKAP enrollment ID — eligibility is confirmed at check-in."
                style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                Patients will see &quot;YAKAP Available ✓&quot; — this never implies automatic eligibility or coverage.
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
          <button onClick={saveDefaults} disabled={pending} style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {pending ? "Saving…" : "Save Clinic Default"}
          </button>
          {saved && !pending && <span style={{ fontSize: 12, color: "#1a7f37" }}>Saved.</span>}
          {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
        </div>
      </div>

      <HmoCatalog hmos={hmos} />

      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 4 }}>Provider Overrides</h2>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 14 }}>
          A provider only accepts an HMO your clinic lists above if they&apos;re actually configured to — never assumed
          just because another provider in the clinic accepts it.
        </p>
        {providers.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#999" }}>No active providers yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {providers.map((p) => (
              <ProviderCoverageRow
                key={p.id}
                provider={p}
                override={overrides.find((o) => o.provider_id === p.id) ?? null}
                hmos={hmos}
                selectedHmoIds={providerHmoLinks.filter((l) => l.provider_id === p.id).map((l) => l.hmo_id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function HmoCatalog({ hmos }: { hmos: Hmo[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h2 style={{ fontSize: 14, margin: 0 }}>Accepted HMOs</h2>
        <button
          onClick={() => setAdding(true)}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", background: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
        >
          + Add HMO
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#888", marginTop: 4, marginBottom: 14 }}>Fully your own list — add, deactivate, or edit any HMO; nothing here is a hardcoded example.</p>
      {hmos.length === 0 && !adding ? (
        <p style={{ fontSize: 12.5, color: "#999" }}>No HMOs added yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {hmos.map((h) => (
            <HmoRow key={h.id} hmo={h} />
          ))}
        </div>
      )}
      {adding && (
        <div style={{ marginTop: 12 }}>
          <HmoRow
            hmo={{ id: "", hmo_name: "", is_active: true, verification_requirement: "none", patient_instructions: "", notes: "" }}
            forceExpanded
            onDoneAdding={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}

function HmoRow({ hmo, forceExpanded, onDoneAdding }: { hmo: Hmo; forceExpanded?: boolean; onDoneAdding?: () => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(!!forceExpanded);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState({
    hmoName: hmo.hmo_name,
    isActive: hmo.is_active,
    verificationRequirement: hmo.verification_requirement,
    patientInstructions: hmo.patient_instructions ?? "",
    notes: hmo.notes ?? "",
  });

  function save() {
    if (!value.hmoName.trim()) {
      setError("HMO name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await setClinicAcceptedHmoAction({
          id: hmo.id || null,
          hmoName: value.hmoName.trim(),
          isActive: value.isActive,
          verificationRequirement: value.verificationRequirement,
          patientInstructions: value.patientInstructions || null,
          notes: value.notes || null,
        });
        if (onDoneAdding) onDoneAdding();
        else {
          setExpanded(false);
          router.refresh();
        }
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  return (
    <div style={{ border: "1px solid var(--card-border)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)" }}>{hmo.hmo_name || "New HMO"}</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: hmo.is_active ? "#1a7f37" : "#888" }}>{hmo.is_active ? "Active" : "Inactive"}</span>
        </div>
        {!forceExpanded && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", background: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
          >
            {expanded ? "Close" : "Edit"}
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div>
            <label style={labelStyle()}>HMO Name</label>
            <input value={value.hmoName} onChange={(e) => setValue({ ...value, hmoName: e.target.value })} style={inputStyle()} placeholder="e.g. Maxicare" />
          </div>
          <Toggle checked={value.isActive} onChange={(v) => setValue({ ...value, isActive: v })} label="Active (shown to patients)" />
          <div>
            <label style={labelStyle()}>Verification Requirement</label>
            <select value={value.verificationRequirement} onChange={(e) => setValue({ ...value, verificationRequirement: e.target.value })} style={inputStyle()}>
              {VERIFICATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Patient Instructions (optional)</label>
            <textarea value={value.patientInstructions} onChange={(e) => setValue({ ...value, patientInstructions: e.target.value })} rows={2} style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={labelStyle()}>Internal Notes / Accreditation Notes (staff only)</label>
            <textarea value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} rows={2} style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={save} disabled={pending} style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {pending ? "Saving…" : "Save HMO"}
            </button>
            {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCoverageRow({ provider, override, hmos, selectedHmoIds }: { provider: Provider; override: ProviderOverrideRow | null; hmos: Hmo[]; selectedHmoIds: string[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const customized = isOverrideCustomized(override);
  const base = override ?? emptyOverride(provider.id);

  const [acceptHmo, setAcceptHmo] = useState(override?.accept_hmo ?? null);
  const [acceptYakap, setAcceptYakap] = useState(override?.accept_yakap ?? null);
  const [selectedHmos, setSelectedHmos] = useState<string[]>(selectedHmoIds);

  function toggleHmo(id: string) {
    setSelectedHmos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await setProviderPatientAccessSettingsAction({
          ...toOverrideActionInput(base),
          acceptHmo,
          acceptYakap,
        });
        await setProviderHmoAcceptanceAction(provider.id, selectedHmos);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  function revert() {
    setError(null);
    startTransition(async () => {
      try {
        await revertProviderToClinicDefaultsAction(provider.id);
        await setProviderHmoAcceptanceAction(provider.id, []);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't revert.");
      }
    });
  }

  return (
    <div style={{ border: "1px solid var(--card-border)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)" }}>
            {provider.title ? `${provider.title} ` : ""}
            {provider.full_name}
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: customized ? "#7a5c12" : "#888",
              background: customized ? "#fff7e6" : "#f2f2f2",
              border: `1px solid ${customized ? "#e6c66b" : "#ddd"}`,
              borderRadius: 999,
              padding: "2px 8px",
              marginTop: 4,
              display: "inline-block",
            }}
          >
            {customized ? "Customized for This Provider" : "Using Clinic Defaults"}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", background: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
        >
          {expanded ? "Close" : "Customize"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--card-border)", display: "grid", gap: 12 }}>
          <div>
            <label style={labelStyle()}>Accept HMO</label>
            <select value={acceptHmo === null ? "inherit" : acceptHmo ? "yes" : "no"} onChange={(e) => setAcceptHmo(e.target.value === "inherit" ? null : e.target.value === "yes")} style={inputStyle()}>
              <option value="inherit">Inherit clinic default</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Participate in YAKAP</label>
            <select value={acceptYakap === null ? "inherit" : acceptYakap ? "yes" : "no"} onChange={(e) => setAcceptYakap(e.target.value === "inherit" ? null : e.target.value === "yes")} style={inputStyle()}>
              <option value="inherit">Inherit clinic default</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {acceptHmo && (
            <div>
              <label style={labelStyle()}>Which HMOs does this provider accept?</label>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Leave all unchecked to accept the full clinic list above.</div>
              <div style={{ display: "grid", gap: 6 }}>
                {hmos.filter((h) => h.is_active).map((h) => (
                  <Toggle key={h.id} checked={selectedHmos.includes(h.id)} onChange={() => toggleHmo(h.id)} label={h.hmo_name} />
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={save} disabled={pending} style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {pending ? "Saving…" : "Save"}
            </button>
            {(customized || selectedHmoIds.length > 0) && (
              <button onClick={revert} disabled={pending} style={{ background: "none", color: "#a12a2a", border: "1px solid #e6b3b3", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                Revert to Clinic Defaults
              </button>
            )}
            {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
