"use client";

import { useState, useTransition } from "react";
import { setPromotionActiveAction } from "@/app/admin/actions";

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly only",
  yearly: "Yearly only",
  both: "Monthly & yearly",
};

function describeDiscount(p: any): string {
  if (p.discount_type === "free_trial") {
    const days = p.trial_duration_days ? `${p.trial_duration_days}-day` : "free";
    return p.follow_on_promotion_id ? `${days} free trial → follow-on promo` : `${days} free trial`;
  }
  if (p.discount_type === "fixed_amount") return `₱${Number(p.fixed_amount_php ?? 0).toLocaleString()} off`;
  return `${p.discount_percent}% off`;
}

function describeDuration(p: any): string | null {
  if (p.discount_type === "free_trial") return null;
  switch (p.duration_type) {
    case "billing_cycles":
      return `first ${p.duration_value ?? "?"} billing cycle${p.duration_value === 1 ? "" : "s"}`;
    case "months":
      return `first ${p.duration_value ?? "?"} month${p.duration_value === 1 ? "" : "s"}`;
    case "until_date":
      return p.ends_at ? `until ${new Date(p.ends_at).toLocaleDateString()}` : "until a set date";
    case "ongoing":
    default:
      return null;
  }
}

export function PromotionRow({ promotion }: { promotion: any }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(promotion.is_active);
  const [error, setError] = useState<string | null>(null);

  const capped = promotion.max_redemptions !== null && promotion.redemptions_count >= promotion.max_redemptions;
  const expiredByDate = promotion.ends_at ? new Date(promotion.ends_at) < new Date() : false;
  const statusLabel = !isActive ? (capped ? "used up" : "off") : expiredByDate ? "expired" : "active";
  const statusColor = statusLabel === "active" ? "#1a7f37" : statusLabel === "used up" ? "#c99a2e" : "#888";

  function toggle() {
    const next = !isActive;
    setIsActive(next);
    startTransition(async () => {
      try {
        await setPromotionActiveAction(promotion.id, next);
      } catch (e: any) {
        setIsActive(!next);
        setError(e.message);
      }
    });
  }

  const durationText = describeDuration(promotion);

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {promotion.label}
            <span
              style={{
                marginLeft: 10,
                fontSize: 11,
                fontWeight: 600,
                color: statusColor,
                border: `1px solid ${statusColor}`,
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              {statusLabel}
            </span>
            {promotion.target_tenant_id && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#7a5c12",
                  background: "#fff7e6",
                  border: "1px solid #e6c66b",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                {promotion.tenants?.name ?? "one clinic"} only
              </span>
            )}
          </div>
          {promotion.description && <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{promotion.description}</div>}
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            {describeDiscount(promotion)}
            {durationText ? ` · ${durationText}` : ""} · {promotion.plans?.name ?? "All plans"}
            {promotion.billing_cycle_scope ? ` · ${CYCLE_LABEL[promotion.billing_cycle_scope] ?? promotion.billing_cycle_scope}` : ""}
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            {promotion.code ? (
              <>
                Code <strong>{promotion.code}</strong>
                {promotion.requires_code ? "" : " (also applies automatically)"}
              </>
            ) : (
              "Applies automatically"
            )}
            {" · "}
            Used {promotion.redemptions_count}
            {promotion.max_redemptions !== null ? ` / ${promotion.max_redemptions}` : ""} time
            {promotion.redemptions_count === 1 ? "" : "s"}
            {promotion.ends_at && promotion.duration_type !== "until_date" ? ` · expires ${new Date(promotion.ends_at).toLocaleDateString()}` : ""}
          </div>
          {(promotion.applies_to_seats || (promotion.applies_to_addon_ids && promotion.applies_to_addon_ids.length > 0)) && (
            <div style={{ fontSize: 12, color: "#888" }}>
              Also covers{" "}
              {[
                promotion.applies_to_seats ? "extra provider seats" : null,
                promotion.applies_to_addon_ids?.length ? `${promotion.applies_to_addon_ids.length} add-on${promotion.applies_to_addon_ids.length === 1 ? "" : "s"}` : null,
              ]
                .filter(Boolean)
                .join(" and ")}
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: "crimson", marginTop: 6 }}>{error}</div>}
        </div>

        <button
          onClick={toggle}
          disabled={pending}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            color: "white",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
            background: isActive ? "#a12a2a" : "#1a7f37",
            flexShrink: 0,
          }}
        >
          {isActive ? "Turn off" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
