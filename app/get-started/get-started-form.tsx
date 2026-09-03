"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startSignupCheckoutAction, previewCheckoutAction } from "./actions";
import { SignupQrCheckout } from "./signup-qr-checkout";
import { describePromoDuration, describePromoRejection, type CheckoutPreview } from "@/lib/billing/compute-promo";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  plan_prices: { billing_cycle: string; price_php: number }[];
  plan_features?: { feature_key: string; features: { label: string } | null }[];
};
type Addon = { id: string; name: string; slug: string; addon_prices: { billing_cycle: string; price_php: number }[] };
type ExistingRequest = {
  id: string;
  clinic_name: string | null;
  contact_phone: string | null;
  requested_plan_id: string | null;
  requested_billing_cycle: string | null;
  requested_addon_ids: string[] | null;
  paymongo_payment_intent_id: string | null;
  status: string;
  agreement_acceptance_id: string | null;
} | null;
type Agreement = { id: string; version: number; title: string; body_markdown: string } | null;

const ALL_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "Lifetime" },
] as const;

function priceFor(prices: { billing_cycle: string; price_php: number }[], cycle: string) {
  const p = prices.find((x) => x.billing_cycle === cycle);
  return p ? Number(p.price_php) : 0;
}

export function GetStartedForm({
  plans,
  addons,
  hasCodePromotions,
  defaultClinicName,
  defaultPhone,
  existingRequest,
  initialPlanId,
  initialCycle,
  enabledCycles,
  agreement,
  defaultClinicLegalName,
  defaultFullLegalName,
}: {
  plans: Plan[];
  addons: Addon[];
  // Just enough to decide whether to show the promo-code field at all —
  // the actual matching/eligibility (code or auto-applied, expiry, caps,
  // billing-cycle scope, etc.) is resolved server-side by
  // preview_checkout_total. See lib/billing/compute-promo.ts.
  hasCodePromotions: boolean;
  defaultClinicName: string;
  defaultPhone: string;
  existingRequest: ExistingRequest;
  initialPlanId: string | null;
  initialCycle: string | null;
  enabledCycles?: { monthly: boolean; yearly: boolean; one_time: boolean };
  agreement: Agreement;
  defaultClinicLegalName: string;
  defaultFullLegalName: string;
}) {
  const router = useRouter();

  // Which billing cycles are offered is Superadmin-configurable (Settings →
  // Commerce) rather than hardcoded here — see migration
  // 028_admin_advanced_controls / commerce_settings.
  const CYCLES = ALL_CYCLES.filter((c) => enabledCycles?.[c.value] !== false);

  const [clinicName, setClinicName] = useState(existingRequest?.clinic_name ?? defaultClinicName);
  const [phone, setPhone] = useState(existingRequest?.contact_phone ?? defaultPhone);
  const [planId, setPlanId] = useState(existingRequest?.requested_plan_id ?? initialPlanId ?? plans[0]?.id ?? "");
  const requestedCycle = (existingRequest?.requested_billing_cycle as any) ?? (initialCycle as any) ?? "monthly";
  const [cycle, setCycle] = useState<(typeof ALL_CYCLES)[number]["value"]>(
    CYCLES.some((c) => c.value === requestedCycle) ? requestedCycle : CYCLES[0]?.value ?? "monthly"
  );
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set(existingRequest?.requested_addon_ids ?? []));
  const [promoCode, setPromoCode] = useState("");

  // Agreement-before-payment. Already-accepted requests (a returning
  // visitor who tweaked their plan after accepting) skip straight past
  // this — the server never re-checks these three fields in that case
  // either, see startSignupCheckoutAction.
  const alreadyAccepted = Boolean(existingRequest?.agreement_acceptance_id);
  const [agreementChecked, setAgreementChecked] = useState(alreadyAccepted);
  const [showAgreementText, setShowAgreementText] = useState(false);
  const [fullLegalName, setFullLegalName] = useState(defaultFullLegalName);
  const [roleTitle, setRoleTitle] = useState("");
  const [clinicLegalName, setClinicLegalName] = useState(defaultClinicLegalName);

  const [status, setStatus] = useState<"idle" | "submitting" | "checkout" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [checkout, setCheckout] = useState<{ requestId: string; paymentIntentId: string; qrImage: string; amount: number } | null>(
    null
  );

  const plan = plans.find((p) => p.id === planId);
  const addonIds = Array.from(selectedAddons);

  // Live preview — recomputed server-side (single source of truth, shared
  // with the actual charge in startSignupCheckoutAction) any time the
  // selection changes. Debounced slightly so typing a promo code doesn't
  // fire a request per keystroke.
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestSeq = useRef(0);

  useEffect(() => {
    if (!planId) return;
    const seq = ++previewRequestSeq.current;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      previewCheckoutAction({ planId, cycle, addonIds: Array.from(selectedAddons), promoCode: promoCode || null })
        .then((result) => {
          if (previewRequestSeq.current !== seq) return; // a newer request already superseded this one
          setPreview(result);
          setPreviewError(null);
        })
        .catch((e: any) => {
          if (previewRequestSeq.current !== seq) return;
          setPreview(null);
          setPreviewError(e.message);
        })
        .finally(() => {
          if (previewRequestSeq.current === seq) setPreviewLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, cycle, addonIds.join(","), promoCode]);

  const subtotal = preview?.subtotal ?? 0;
  const discountAmount = preview?.discount_php ?? 0;
  const total = preview?.total ?? subtotal;
  const promoResult = preview?.promotion;
  const promoDuration = promoResult ? describePromoDuration(promoResult) : null;
  const promoRejection = promoResult ? describePromoRejection(promoResult.reason, promoCode.trim().length > 0) : null;

  const agreementReady =
    alreadyAccepted ||
    (agreementChecked && fullLegalName.trim().length > 0 && roleTitle.trim().length > 0 && clinicLegalName.trim().length > 0);

  function toggleAddon(id: string) {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function proceedToPayment() {
    setStatus("submitting");
    setErrorMsg("");
    try {
      const result = await startSignupCheckoutAction(existingRequest?.id ?? null, {
        clinicName,
        contactPhone: phone,
        planId,
        cycle,
        addonIds: Array.from(selectedAddons),
        promoCode: promoCode || null,
        agreementAccepted: agreementChecked,
        fullLegalName,
        roleTitle,
        clinicLegalName,
      });
      setCheckout(result);
      setStatus("checkout");
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message);
    }
  }

  function handlePaid() {
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  }

  if (status === "checkout" && checkout) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{clinicName}</div>
          <div style={{ fontSize: 13, color: "#666" }}>
            {plan?.name} · {CYCLES.find((c) => c.value === cycle)?.label}
            {selectedAddons.size > 0 ? ` + ${selectedAddons.size} add-on${selectedAddons.size > 1 ? "s" : ""}` : ""}
          </div>
        </div>
        <SignupQrCheckout
          requestId={checkout.requestId}
          paymentIntentId={checkout.paymentIntentId}
          qrImage={checkout.qrImage}
          amount={checkout.amount}
          onPaid={handlePaid}
        />
        <button
          onClick={() => setStatus("idle")}
          style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", textAlign: "left" }}
        >
          ← Change my plan/add-ons instead
        </button>
      </div>
    );
  }

  return (
    <div>
      <a href="/" style={{ display: "inline-block", fontSize: 13, color: "#888", textDecoration: "none", marginBottom: 12 }}>
        ← Back to pricing
      </a>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          proceedToPayment();
        }}
        style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24 }}
      >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <input required placeholder="Clinic name" value={clinicName} onChange={(e) => setClinicName(e.target.value)} style={input} />
        <input required placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>Plan</label>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {plans.map((p) => {
            const price = priceFor(p.plan_prices, cycle);
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setPlanId(p.id)}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 10,
                  border: `1px solid ${planId === p.id ? "#2563eb" : "#ddd"}`,
                  background: planId === p.id ? "#eff4ff" : "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                  {price > 0 ? `₱${price.toLocaleString()}` : "not offered this way"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>Billing</label>
        <div style={{ display: "flex", gap: 8 }}>
          {CYCLES.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => setCycle(c.value)}
              style={{
                ...chip,
                borderColor: cycle === c.value ? "#2563eb" : "#ddd",
                background: cycle === c.value ? "#eff4ff" : "white",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {addons.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Add-ons (separate pricing)</label>
          <div style={{ display: "grid", gap: 6 }}>
            {addons.map((a) => (
              <label key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 10px", border: "1px solid #eee", borderRadius: 8 }}>
                <span>
                  <input type="checkbox" checked={selectedAddons.has(a.id)} onChange={() => toggleAddon(a.id)} style={{ marginRight: 8 }} />
                  {a.name}
                </span>
                <span style={{ color: "#888" }}>₱{priceFor(a.addon_prices, cycle).toLocaleString()} / {cycle}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {hasCodePromotions && (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Promo code (optional)</label>
          <input
            placeholder="Have a code? Enter it here"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            style={{ ...input, width: "100%", boxSizing: "border-box" }}
          />
        </div>
      )}

      {promoResult?.applicable && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16, color: "#7a5c12" }}>
          🎉 {promoResult.promotion_label} — <strong>₱{(promoResult.discount_php ?? 0).toLocaleString()} off</strong>
          {promoDuration ? ` ${promoDuration}` : ""}
        </div>
      )}
      {!promoResult?.applicable && promoRejection && (
        <div style={{ background: "#fdf3f3", border: "1px solid #f3c6c6", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16, color: "#a12a2a" }}>
          {promoRejection}
        </div>
      )}

      {agreement && !alreadyAccepted && (
        <div style={{ marginBottom: 16, background: "#f9fafb", border: "1px solid #e2e2e5", borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{agreement.title}</div>
          <button
            type="button"
            onClick={() => setShowAgreementText((v) => !v)}
            style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 10 }}
          >
            {showAgreementText ? "Hide full agreement ▲" : "Read full agreement ▼"}
          </button>
          {showAgreementText && (
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                lineHeight: 1.6,
                color: "#444",
                maxHeight: 260,
                overflowY: "auto",
                background: "white",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
              }}
            >
              {agreement.body_markdown}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={label}>Your full legal name</label>
              <input value={fullLegalName} onChange={(e) => setFullLegalName(e.target.value)} style={{ ...input, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={label}>Your role / title</label>
              <input
                placeholder="e.g. Clinic Owner, Practice Manager"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                style={{ ...input, width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={label}>Clinic's legal name</label>
              <input value={clinicLegalName} onChange={(e) => setClinicLegalName(e.target.value)} style={{ ...input, width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#444" }}>
            <input type="checkbox" checked={agreementChecked} onChange={(e) => setAgreementChecked(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              I have authority to accept this on behalf of the clinic named above, and I agree to the{" "}
              {agreement.title} (v{agreement.version}).
            </span>
          </label>
        </div>
      )}
      {alreadyAccepted && (
        <p style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>
          ✓ You already accepted the Subscription & Services Agreement for this request.
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #eee" }}>
        <div style={{ fontSize: 14 }}>
          {previewLoading && !preview ? (
            <span style={{ color: "#999" }}>Calculating…</span>
          ) : discountAmount > 0 ? (
            <>
              <span style={{ textDecoration: "line-through", color: "#999", marginRight: 8 }}>₱{subtotal.toLocaleString()}</span>
              Total: <strong>₱{total.toLocaleString()}</strong>
            </>
          ) : (
            <>
              Total: <strong>₱{total.toLocaleString()}</strong>
            </>
          )}
        </div>
        <button
          type="submit"
          disabled={status === "submitting" || previewLoading || !preview || total <= 0 || !agreementReady}
          style={submitBtn}
        >
          {status === "submitting" ? "Preparing checkout..." : "Continue to payment →"}
        </button>
      </div>
      {!agreementReady && !previewLoading && preview && total > 0 && (
        <p style={{ fontSize: 11, color: "#a12a2a", marginTop: 8 }}>
          Please accept the Subscription & Services Agreement above (and fill in your name, role, and clinic's legal
          name) before continuing to payment.
        </p>
      )}
      {status === "error" && <p style={{ color: "crimson", fontSize: 13, marginTop: 8 }}>{errorMsg}</p>}
      {previewError && <p style={{ color: "crimson", fontSize: 13, marginTop: 8 }}>{previewError}</p>}
      <p style={{ fontSize: 11, color: "#999", marginTop: 10 }}>
        You'll pay with a QR code (GCash, Maya, or your banking app). Your clinic's portal unlocks automatically the
        moment payment is confirmed — no waiting on approval.
      </p>
      </form>
    </div>
  );
}

const input: React.CSSProperties = { padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 };
const chip: React.CSSProperties = { padding: "6px 12px", borderRadius: 999, border: "1px solid #ddd", fontSize: 13, cursor: "pointer" };
const submitBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#0c1730",
  color: "#e6c66b",
  fontWeight: 700,
  cursor: "pointer",
};
