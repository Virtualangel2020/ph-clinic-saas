"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCancellationPolicyAction } from "../actions";

const LATE_WINDOW_OPTIONS = [
  { value: 120, label: "2 hours" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
  { value: 2880, label: "48 hours" },
];

const NO_SHOW_AFTER_OPTIONS = [
  { value: "never", label: "Never charge a no-show fee" },
  { value: "1", label: "After the 1st no-show" },
  { value: "2", label: "After the 2nd no-show" },
  { value: "3", label: "After the 3rd no-show" },
  { value: "custom", label: "Custom count" },
];

const PREPAID_MODE_OPTIONS = [
  { value: "keep_0", label: "Keep 0% — Full Refund" },
  { value: "keep_percent", label: "Keep a Percentage" },
  { value: "keep_fixed", label: "Keep a Fixed Amount" },
  { value: "keep_100", label: "Keep 100% — Non-Refundable" },
  { value: "convert_credit", label: "Convert to Clinic Credit" },
  { value: "manual_review", label: "Review Manually" },
];

const REFUND_MODE_OPTIONS = [
  { value: "full", label: "Full Refund" },
  { value: "percent", label: "Partial — Percentage" },
  { value: "fixed", label: "Partial — Fixed Amount" },
  { value: "credit", label: "Clinic Credit" },
  { value: "none", label: "No Refund" },
  { value: "manual_review", label: "Review Manually" },
];

type Policy = {
  lateCancellationWindowMinutes: number;
  noShowFee: { afterCount: string; afterCountCustom: number | null; amountPhp: number | null };
  prepaidNoShow: { mode: string; percent: number | null; fixedAmountPhp: number | null };
  cancellationRefund: { mode: string; percent: number | null; fixedAmountPhp: number | null };
  lateCancellationRefund: { mode: string; percent: number | null; fixedAmountPhp: number | null };
};

const DEFAULT_POLICY: Policy = {
  lateCancellationWindowMinutes: 1440,
  noShowFee: { afterCount: "never", afterCountCustom: null, amountPhp: null },
  prepaidNoShow: { mode: "keep_0", percent: null, fixedAmountPhp: null },
  cancellationRefund: { mode: "full", percent: null, fixedAmountPhp: null },
  lateCancellationRefund: { mode: "full", percent: null, fixedAmountPhp: null },
};

function cardStyle(): React.CSSProperties {
  return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 20 };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" };
}
function inputStyle(): React.CSSProperties {
  return { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--input-border, #ddd)", fontSize: 13, background: "var(--input-bg, white)", color: "var(--text-heading)" };
}

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function RefundModeFields({ label, value, onChange, disabled }: { label: string; value: Policy["cancellationRefund"]; onChange: (v: Policy["cancellationRefund"]) => void; disabled?: boolean }) {
  return (
    <div>
      <label style={labelStyle()}>{label}</label>
      <select disabled={disabled} value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value })} style={inputStyle()}>
        {REFUND_MODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {value.mode === "percent" && (
        <div style={{ marginTop: 8 }}>
          <input
            disabled={disabled}
            type="number"
            min={0}
            max={100}
            value={value.percent ?? 0}
            onChange={(e) => onChange({ ...value, percent: Math.max(0, Math.min(100, Number(e.target.value))) })}
            style={{ ...inputStyle(), maxWidth: 140 }}
          />
          <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>% refunded to patient</span>
        </div>
      )}
      {value.mode === "fixed" && (
        <div style={{ marginTop: 8 }}>
          <input disabled={disabled} type="number" min={0} value={value.fixedAmountPhp ?? 0} onChange={(e) => onChange({ ...value, fixedAmountPhp: Number(e.target.value) })} style={{ ...inputStyle(), maxWidth: 140 }} />
          <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>₱ refunded to patient</span>
        </div>
      )}
    </div>
  );
}

export function CancellationManager({
  clinicPolicy,
  clinicPolicyVersion,
  providers,
  overrides,
}: {
  clinicPolicy: Policy | null;
  clinicPolicyVersion: number;
  providers: { id: string; full_name: string; title: string | null }[];
  overrides: { provider_id: string; cancellation_policy: Policy | null; cancellation_policy_version: number | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [policy, setPolicy] = useState<Policy>(clinicPolicy ?? DEFAULT_POLICY);

  const simple = policy.noShowFee.afterCount === "never" && policy.prepaidNoShow.mode === "keep_0";

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setCancellationPolicyAction("clinic", null, policy);
        setSaved(true);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  const examplePercent = policy.prepaidNoShow.percent ?? 25;
  const exampleFee = Math.round(1000 * (examplePercent / 100));

  return (
    <>
      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 4 }}>Clinic-Wide Policy</h2>
        <p style={{ fontSize: 11.5, color: "#888", marginTop: 0, marginBottom: 14 }}>Version {clinicPolicyVersion} — a future edit never changes what a patient already acknowledged at booking.</p>

        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={labelStyle()}>Late Cancellation Window</label>
            <select value={policy.lateCancellationWindowMinutes} onChange={(e) => setPolicy({ ...policy, lateCancellationWindowMinutes: Number(e.target.value) })} style={inputStyle()}>
              {LATE_WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Cancelling within this window of the appointment counts as a Late Cancellation instead of a Regular Cancellation.</div>
          </div>

          <div>
            <label style={labelStyle()}>No-Show Fee Threshold</label>
            <select
              value={policy.noShowFee.afterCount}
              onChange={(e) => setPolicy({ ...policy, noShowFee: { ...policy.noShowFee, afterCount: e.target.value } })}
              style={inputStyle()}
            >
              {NO_SHOW_AFTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {policy.noShowFee.afterCount === "custom" && (
              <input
                type="number"
                min={1}
                placeholder="No-show count"
                value={policy.noShowFee.afterCountCustom ?? ""}
                onChange={(e) => setPolicy({ ...policy, noShowFee: { ...policy.noShowFee, afterCountCustom: Number(e.target.value) } })}
                style={{ ...inputStyle(), maxWidth: 140, marginTop: 8 }}
              />
            )}
            {policy.noShowFee.afterCount !== "never" && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="number"
                  min={0}
                  placeholder="Fee amount (₱)"
                  value={policy.noShowFee.amountPhp ?? ""}
                  onChange={(e) => setPolicy({ ...policy, noShowFee: { ...policy.noShowFee, amountPhp: Number(e.target.value) } })}
                  style={{ ...inputStyle(), maxWidth: 160 }}
                />
                <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>₱ charged for a no-show past the threshold</span>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle()}>Prepaid Appointment — No-Show Handling</label>
            <select value={policy.prepaidNoShow.mode} onChange={(e) => setPolicy({ ...policy, prepaidNoShow: { ...policy.prepaidNoShow, mode: e.target.value } })} style={inputStyle()}>
              {PREPAID_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {policy.prepaidNoShow.mode === "keep_percent" && (
              <>
                <div style={{ marginTop: 8 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={policy.prepaidNoShow.percent ?? 25}
                    onChange={(e) => setPolicy({ ...policy, prepaidNoShow: { ...policy.prepaidNoShow, percent: Math.max(0, Math.min(100, Number(e.target.value))) } })}
                    style={{ ...inputStyle(), maxWidth: 140 }}
                  />
                  <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>% retained by the clinic</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#4a6fa5", marginTop: 6, background: "#eef3fb", border: "1px solid #d3e0f2", borderRadius: 8, padding: "8px 10px" }}>
                  Example — Appointment payment: {peso(1000)}. No-show retention: {examplePercent}%. Clinic retains: {peso(exampleFee)}. Potential refund: {peso(1000 - exampleFee)}.
                </div>
              </>
            )}
            {policy.prepaidNoShow.mode === "keep_fixed" && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="number"
                  min={0}
                  value={policy.prepaidNoShow.fixedAmountPhp ?? 0}
                  onChange={(e) => setPolicy({ ...policy, prepaidNoShow: { ...policy.prepaidNoShow, fixedAmountPhp: Number(e.target.value) } })}
                  style={{ ...inputStyle(), maxWidth: 140 }}
                />
                <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>₱ retained by the clinic</span>
              </div>
            )}
          </div>

          <RefundModeFields label="Regular Cancellation Refund" value={policy.cancellationRefund} onChange={(v) => setPolicy({ ...policy, cancellationRefund: v })} />
          <RefundModeFields label="Late Cancellation Refund" value={policy.lateCancellationRefund} onChange={(v) => setPolicy({ ...policy, lateCancellationRefund: v })} />

          {simple && (
            <div style={{ fontSize: 12, color: "#1a7f37", background: "#eaf7ee", border: "1px solid #bfe6c9", borderRadius: 8, padding: "8px 10px" }}>
              No advance payment and no no-show fee configured — patients will only see a simple cancellation notice, not complex refund language.
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
          <button onClick={save} disabled={pending} style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {pending ? "Saving…" : "Save Policy"}
          </button>
          {saved && !pending && <span style={{ fontSize: 12, color: "#1a7f37" }}>Saved — version bumped, existing patient acknowledgements unaffected.</span>}
          {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
        </div>
      </div>

      <div style={cardStyle()}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 4 }}>Provider Overrides</h2>
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 14 }}>Most clinics use one policy for every provider. Only override this if a specific provider genuinely has different terms.</p>
        {providers.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#999" }}>No active providers yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {providers.map((p) => (
              <ProviderPolicyRow key={p.id} provider={p} override={overrides.find((o) => o.provider_id === p.id) ?? null} clinicPolicy={policy} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ProviderPolicyRow({
  provider,
  override,
  clinicPolicy,
}: {
  provider: { id: string; full_name: string; title: string | null };
  override: { provider_id: string; cancellation_policy: Policy | null; cancellation_policy_version: number | null } | null;
  clinicPolicy: Policy;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const customized = !!override?.cancellation_policy;
  const [useOverride, setUseOverride] = useState(customized);
  const [policy, setPolicy] = useState<Policy>(override?.cancellation_policy ?? clinicPolicy);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const { setCancellationPolicyAction: action } = await import("../actions");
        if (useOverride) {
          await action("provider", provider.id, policy);
        } else {
          await action("provider", provider.id, null);
        }
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
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
            {customized ? "Customized Policy" : "Using Clinic Policy"}
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
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--card-border)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={useOverride} onChange={(e) => setUseOverride(e.target.checked)} />
            Customize for This Provider (uncheck to use the clinic policy)
          </label>
          {useOverride && (
            <div style={{ display: "grid", gap: 12 }}>
              <RefundModeFields label="Regular Cancellation Refund" value={policy.cancellationRefund} onChange={(v) => setPolicy({ ...policy, cancellationRefund: v })} disabled={pending} />
              <RefundModeFields label="Late Cancellation Refund" value={policy.lateCancellationRefund} onChange={(v) => setPolicy({ ...policy, lateCancellationRefund: v })} disabled={pending} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <button onClick={save} disabled={pending} style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {pending ? "Saving…" : "Save"}
            </button>
            {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
