"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPatientInsuranceAction, setPatientInsuranceStatusAction } from "../../insurance/actions";
import { setPhilhealthAction } from "../../philhealth/actions";

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

export type InsurancePlanRow = {
  id: string;
  provider_name: string;
  member_number: string | null;
  plan_name: string | null;
  status: string; // active | inactive | expired
  effective_date: string | null;
  expiry_date: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  active: { bg: "#eaf7ee", border: "#bfe6c9", color: "#1a7f37" },
  inactive: { bg: "#f2f2f2", border: "#ddd", color: "#666" },
  expired: { bg: "#fbebeb", border: "#eec7c7", color: "#a12a2a" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.inactive;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px", textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

// Insurance/HMO + PhilHealth, shown together on the patient chart because
// both are "coverage" the front desk checks before a visit — but they are
// independent: PhilHealth is two plain columns on patients (set via the
// set_philhealth RPC), insurance plans are their own small list of rows
// (add_patient_insurance / set_patient_insurance_status RPCs). See
// /dashboard/insurance and /dashboard/philhealth for the clinic-wide
// views these same writes show up in.
export function InsurancePhilhealthSection({
  patientId,
  philhealthNumber,
  philhealthMemberType,
  insurancePlans,
}: {
  patientId: string;
  philhealthNumber: string | null;
  philhealthMemberType: string | null;
  insurancePlans: InsurancePlanRow[];
}) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, marginTop: 20 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12 }}>Insurance / HMO &amp; PhilHealth</h2>
      <div style={{ display: "grid", gap: 16 }}>
        <PhilhealthRow patientId={patientId} number={philhealthNumber} memberType={philhealthMemberType} />
        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 14 }}>
          <InsurancePlansRow patientId={patientId} plans={insurancePlans} />
        </div>
      </div>
    </div>
  );
}

function PhilhealthRow({ patientId, number, memberType }: { patientId: string; number: string | null; memberType: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [numberDraft, setNumberDraft] = useState(number ?? "");
  const [memberTypeDraft, setMemberTypeDraft] = useState(memberType ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await setPhilhealthAction(patientId, numberDraft.trim(), memberTypeDraft.trim());
        setEditing(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function startEdit() {
    setNumberDraft(number ?? "");
    setMemberTypeDraft(memberType ?? "");
    setError(null);
    setEditing(true);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 2 }}>PhilHealth</div>
          {editing ? null : number ? (
            <div style={{ fontSize: 13.5 }}>
              {number}
              {memberType && <span style={{ marginLeft: 8, fontSize: 11.5, color: "#888" }}>{memberType}</span>}
            </div>
          ) : (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a12a2a", background: "#fbebeb", border: "1px solid #eec7c7", borderRadius: 999, padding: "2px 8px" }}>
              Missing PhilHealth #
            </span>
          )}
        </div>
        {!editing && (
          <button onClick={startEdit} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {number ? "Change" : "+ Add"}
          </button>
        )}
      </div>

      {error && <p style={{ fontSize: 11.5, color: "crimson", marginTop: 6 }}>{error}</p>}

      {editing && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <input placeholder="PhilHealth number" value={numberDraft} onChange={(e) => setNumberDraft(e.target.value)} style={{ ...FIELD_STYLE, width: 180 }} />
          <input placeholder="Member type (e.g. Member, Dependent)" value={memberTypeDraft} onChange={(e) => setMemberTypeDraft(e.target.value)} style={{ ...FIELD_STYLE, width: 220 }} />
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

const EMPTY_PLAN_DRAFT = { providerName: "", memberNumber: "", planName: "", effectiveDate: "", expiryDate: "" };

function InsurancePlansRow({ patientId, plans }: { patientId: string; plans: InsurancePlanRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_PLAN_DRAFT);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function addPlan() {
    if (!draft.providerName.trim()) {
      setError("Provider name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addPatientInsuranceAction(patientId, draft.providerName.trim(), draft.memberNumber, draft.planName, draft.effectiveDate, draft.expiryDate);
        setDraft(EMPTY_PLAN_DRAFT);
        setAdding(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function setStatus(id: string, status: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await setPatientInsuranceStatusAction(id, patientId, status);
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#666" }}>Insurance / HMO plans</div>
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
              <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Effective date</div>
              <input type="date" value={draft.effectiveDate} onChange={(e) => setDraft({ ...draft, effectiveDate: e.target.value })} style={FIELD_STYLE} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Expiry date</div>
              <input type="date" value={draft.expiryDate} onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })} style={FIELD_STYLE} />
            </div>
          </div>
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
                  </div>
                  <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                    {p.member_number ? `#${p.member_number}` : "No member # on file"}
                    {p.effective_date ? ` · Effective ${new Date(p.effective_date).toLocaleDateString()}` : ""}
                    {p.expiry_date ? ` · Expires ${new Date(p.expiry_date).toLocaleDateString()}` : ""}
                  </div>
                </div>
                {p.status !== "expired" && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
