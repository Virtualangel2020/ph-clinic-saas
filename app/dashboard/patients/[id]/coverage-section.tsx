"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPatientInsuranceAction,
  setPatientInsuranceStatusAction,
  setPatientInsurancePrimaryAction,
  setPatientPaymentTypeAction,
} from "../../insurance/actions";
import { setPhilhealthAction } from "../../philhealth/actions";

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const CARD: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16 };

export type InsurancePlanRow = {
  id: string;
  provider_name: string;
  member_number: string | null;
  plan_name: string | null;
  status: string; // active | inactive | expired
  effective_date: string | null;
  expiry_date: string | null;
  is_primary: boolean;
  principal_or_dependent: string | null;
  relationship_to_principal: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  active: { bg: "#eaf7ee", border: "#bfe6c9", color: "#1a7f37" },
  inactive: { bg: "#f2f2f2", border: "#ddd", color: "#666" },
  expired: { bg: "#fbebeb", border: "#eec7c7", color: "#a12a2a" },
};

const PAYMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "hmo", label: "HMO" },
  { value: "philhealth", label: "PhilHealth" },
  { value: "hmo_philhealth", label: "HMO + PhilHealth" },
  { value: "other", label: "Other" },
];

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.inactive;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px", textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

// Coverage tab (spec §6-8): a declared payment type (cash by default — this
// app never assumes a patient has insurance), plus optional PhilHealth and
// HMO/insurance detail underneath. All three pieces write through their
// own SECURITY DEFINER RPCs — see ../../insurance/actions.ts and
// ../../philhealth/actions.ts — and the same rows power the clinic-wide
// /dashboard/insurance and /dashboard/philhealth rollups; nothing here is
// duplicated data. Insurance/PhilHealth card images live in the Documents
// tab's HMO/Insurance and PhilHealth folders, not here — this tab is
// structured membership data only.
export function CoverageSection({
  patientId,
  paymentType,
  philhealthNumber,
  philhealthMemberType,
  philhealthStatus,
  philhealthPrincipalOrDependent,
  philhealthRelationshipToPrincipal,
  insurancePlans,
}: {
  patientId: string;
  paymentType: string;
  philhealthNumber: string | null;
  philhealthMemberType: string | null;
  philhealthStatus: string | null;
  philhealthPrincipalOrDependent: string | null;
  philhealthRelationshipToPrincipal: string | null;
  insurancePlans: InsurancePlanRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changePaymentType(value: string) {
    startTransition(async () => {
      await setPatientPaymentTypeAction(patientId, value);
      router.refresh();
    });
  }

  const showPhilhealth = paymentType === "philhealth" || paymentType === "hmo_philhealth" || !!philhealthNumber;
  const showHmo = paymentType === "hmo" || paymentType === "hmo_philhealth" || insurancePlans.length > 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8 }}>Payment / Coverage Type</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PAYMENT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => changePaymentType(opt.value)}
              disabled={pending}
              style={{
                border: `1px solid ${paymentType === opt.value ? "#0c1730" : "var(--input-border)"}`,
                background: paymentType === opt.value ? "#0c1730" : "transparent",
                color: paymentType === opt.value ? "#e6c66b" : "#555",
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!showPhilhealth && !showHmo && (
        <div style={{ ...CARD, color: "#888", fontSize: 13 }}>
          No insurance or PhilHealth on file — this patient is currently set up as {PAYMENT_TYPE_OPTIONS.find((o) => o.value === paymentType)?.label.toLowerCase() ?? "cash"}.
          Add PhilHealth or an HMO/insurance plan below if that changes.
          <div style={{ marginTop: 10, display: "flex", gap: 16 }}>
            <ShowSectionButton label="+ Add PhilHealth" />
            <ShowSectionButton label="+ Add HMO / Insurance" />
          </div>
        </div>
      )}

      <PhilhealthCard
        patientId={patientId}
        number={philhealthNumber}
        memberType={philhealthMemberType}
        status={philhealthStatus}
        principalOrDependent={philhealthPrincipalOrDependent}
        relationshipToPrincipal={philhealthRelationshipToPrincipal}
        forceShow={showPhilhealth}
      />
      <HmoCard patientId={patientId} plans={insurancePlans} forceShow={showHmo} />
    </div>
  );
}

// Purely cosmetic nudge on the empty state — clicking either one just
// switches payment type to something that reveals the matching card below,
// same as picking it from the pills above.
function ShowSectionButton({ label }: { label: string }) {
  return <span style={{ fontSize: 12, color: "var(--text-heading)", fontWeight: 600 }}>{label} ↓ (use Payment Type above)</span>;
}

function PhilhealthCard({
  patientId,
  number,
  memberType,
  status,
  principalOrDependent,
  relationshipToPrincipal,
  forceShow,
}: {
  patientId: string;
  number: string | null;
  memberType: string | null;
  status: string | null;
  principalOrDependent: string | null;
  relationshipToPrincipal: string | null;
  forceShow: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [numberDraft, setNumberDraft] = useState(number ?? "");
  const [memberTypeDraft, setMemberTypeDraft] = useState(memberType ?? "");
  const [statusDraft, setStatusDraft] = useState(status ?? "");
  const [podDraft, setPodDraft] = useState(principalOrDependent ?? "");
  const [relDraft, setRelDraft] = useState(relationshipToPrincipal ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!forceShow && !editing) return null;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await setPhilhealthAction({
          patientId,
          number: numberDraft.trim(),
          memberType: memberTypeDraft.trim(),
          status: (statusDraft || "") as any,
          principalOrDependent: (podDraft || "") as any,
          relationshipToPrincipal: relDraft.trim(),
        });
        setEditing(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>PhilHealth</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {number ? "Change" : "+ Add"}
          </button>
        )}
      </div>

      {!editing ? (
        number ? (
          <div style={{ fontSize: 13.5, display: "grid", gap: 4 }}>
            <div>
              {number}
              {status && (
                <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, textTransform: "capitalize", color: status === "active" ? "#1a7f37" : "#666" }}>
                  {status}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {[memberType, podDraft && podDraft.charAt(0).toUpperCase() + podDraft.slice(1), relationshipToPrincipal].filter(Boolean).join(" · ") || "No further membership details on file."}
            </div>
            <div style={{ fontSize: 11.5, color: "#999", marginTop: 4 }}>
              Supporting documents (e.g. MDR, ID) are filed under this patient&apos;s Documents tab → PhilHealth folder.
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a12a2a", background: "#fbebeb", border: "1px solid #eec7c7", borderRadius: 999, padding: "2px 8px" }}>
            Missing PhilHealth #
          </span>
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          <input placeholder="PhilHealth number" value={numberDraft} onChange={(e) => setNumberDraft(e.target.value)} style={FIELD_STYLE} />
          <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} style={FIELD_STYLE}>
            <option value="">Status — unspecified</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="unknown">Unknown</option>
          </select>
          <select value={podDraft} onChange={(e) => setPodDraft(e.target.value)} style={FIELD_STYLE}>
            <option value="">Principal / Dependent — unspecified</option>
            <option value="principal">Principal</option>
            <option value="dependent">Dependent</option>
          </select>
          {podDraft === "dependent" && (
            <input placeholder="Relationship to principal (e.g. Spouse, Child)" value={relDraft} onChange={(e) => setRelDraft(e.target.value)} style={FIELD_STYLE} />
          )}
          <input placeholder="Member type / membership details" value={memberTypeDraft} onChange={(e) => setMemberTypeDraft(e.target.value)} style={{ ...FIELD_STYLE, gridColumn: "1 / -1" }} />
          {error && <div style={{ color: "crimson", fontSize: 12, gridColumn: "1 / -1" }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} disabled={pending} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", color: "#555" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_PLAN_DRAFT = {
  providerName: "",
  memberNumber: "",
  planName: "",
  effectiveDate: "",
  expiryDate: "",
  isPrimary: false,
  principalOrDependent: "" as "" | "principal" | "dependent",
  relationshipToPrincipal: "",
};

function HmoCard({ patientId, plans, forceShow }: { patientId: string; plans: InsurancePlanRow[]; forceShow: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_PLAN_DRAFT);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!forceShow && !adding) return null;

  function addPlan() {
    if (!draft.providerName.trim()) {
      setError("Provider name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addPatientInsuranceAction({ patientId, ...draft });
        setDraft(EMPTY_PLAN_DRAFT);
        setAdding(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function setStatus(id: string, status: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await setPatientInsuranceStatusAction(id, patientId, status);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  function setPrimary(id: string, isPrimary: boolean) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await setPatientInsurancePrimaryAction(id, patientId, isPrimary);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>HMO / Insurance</h3>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ Add plan"}
        </button>
      </div>

      {error && !adding && <p style={{ fontSize: 11.5, color: "crimson", marginBottom: 8 }}>{error}</p>}

      {adding && (
        <div style={{ background: "#f7f7f9", border: "1px solid var(--card-border)", borderRadius: 8, padding: 12, marginBottom: 10, display: "grid", gap: 8 }}>
          <input placeholder="Provider (e.g. Maxicare) *" value={draft.providerName} onChange={(e) => setDraft({ ...draft, providerName: e.target.value })} style={FIELD_STYLE} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input placeholder="Member number" value={draft.memberNumber} onChange={(e) => setDraft({ ...draft, memberNumber: e.target.value })} style={FIELD_STYLE} />
            <input placeholder="Plan name" value={draft.planName} onChange={(e) => setDraft({ ...draft, planName: e.target.value })} style={FIELD_STYLE} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Coverage start</div>
              <input type="date" value={draft.effectiveDate} onChange={(e) => setDraft({ ...draft, effectiveDate: e.target.value })} style={FIELD_STYLE} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Coverage end</div>
              <input type="date" value={draft.expiryDate} onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })} style={FIELD_STYLE} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select value={draft.principalOrDependent} onChange={(e) => setDraft({ ...draft, principalOrDependent: e.target.value as any })} style={FIELD_STYLE}>
              <option value="">Principal / Dependent — unspecified</option>
              <option value="principal">Principal</option>
              <option value="dependent">Dependent</option>
            </select>
            {draft.principalOrDependent === "dependent" ? (
              <input placeholder="Relationship to principal" value={draft.relationshipToPrincipal} onChange={(e) => setDraft({ ...draft, relationshipToPrincipal: e.target.value })} style={FIELD_STYLE} />
            ) : (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#555" }}>
                <input type="checkbox" checked={draft.isPrimary} onChange={(e) => setDraft({ ...draft, isPrimary: e.target.checked })} />
                Mark as Primary
              </label>
            )}
          </div>
          {draft.principalOrDependent === "dependent" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#555" }}>
              <input type="checkbox" checked={draft.isPrimary} onChange={(e) => setDraft({ ...draft, isPrimary: e.target.checked })} />
              Mark as Primary
            </label>
          )}
          {error && <p style={{ fontSize: 12, color: "crimson", margin: 0 }}>{error}</p>}
          <button onClick={addPlan} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start" }}>
            {pending ? "Saving…" : "Save plan"}
          </button>
        </div>
      )}

      {plans.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No insurance/HMO plans on file.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {plans.map((p) => (
            <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {p.provider_name}
                    {p.plan_name ? ` — ${p.plan_name}` : ""}
                    <span style={{ marginLeft: 8 }}>
                      <StatusPill status={p.status} />
                    </span>
                    {p.is_primary ? (
                      <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#1a4e8a", background: "#eaf1fd", border: "1px solid #bcd4f7", borderRadius: 999, padding: "2px 8px" }}>
                        Primary
                      </span>
                    ) : (
                      <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#666", background: "#f2f2f2", border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px" }}>
                        Secondary
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                    {p.member_number ? `#${p.member_number}` : "No member # on file"}
                    {p.principal_or_dependent ? ` · ${p.principal_or_dependent.charAt(0).toUpperCase() + p.principal_or_dependent.slice(1)}` : ""}
                    {p.relationship_to_principal ? ` (${p.relationship_to_principal})` : ""}
                    {p.effective_date ? ` · From ${new Date(p.effective_date).toLocaleDateString()}` : ""}
                    {p.expiry_date ? ` to ${new Date(p.expiry_date).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {!p.is_primary && (
                    <button onClick={() => setPrimary(p.id, true)} disabled={pending && busyId === p.id} style={{ fontSize: 11.5, color: "#1a4e8a", background: "none", border: "none", cursor: "pointer" }}>
                      Make primary
                    </button>
                  )}
                  {p.status !== "expired" && (
                    <>
                      {p.status === "active" ? (
                        <button onClick={() => setStatus(p.id, "inactive")} disabled={pending && busyId === p.id} style={{ fontSize: 11.5, color: "#666", background: "none", border: "none", cursor: "pointer" }}>
                          Set inactive
                        </button>
                      ) : (
                        <button onClick={() => setStatus(p.id, "active")} disabled={pending && busyId === p.id} style={{ fontSize: 11.5, color: "#1a7f37", background: "none", border: "none", cursor: "pointer" }}>
                          Set active
                        </button>
                      )}
                      <button onClick={() => setStatus(p.id, "expired")} disabled={pending && busyId === p.id} style={{ fontSize: 11.5, color: "#a12a2a", background: "none", border: "none", cursor: "pointer" }}>
                        Mark expired
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "#999", marginTop: 10 }}>
        Insurance/HMO cards (photos or scans) are filed under this patient&apos;s Documents tab → HMO / Insurance folder.
      </div>
    </div>
  );
}
