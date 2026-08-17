"use client";

import { useState, useTransition } from "react";
import { setPromotionActiveAction } from "@/app/admin/actions";

export function PromotionRow({ promotion }: { promotion: any }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(promotion.is_active);
  const [error, setError] = useState<string | null>(null);

  const capped = promotion.max_redemptions !== null && promotion.redemptions_count >= promotion.max_redemptions;
  const expiredByDate = promotion.ends_at ? new Date(promotion.ends_at) < new Date() : false;
  const statusLabel = !isActive ? (capped ? "used up" : "off") : expiredByDate ? "expired" : "active";
  const statusColor =
    statusLabel === "active" ? "#1a7f37" : statusLabel === "used up" ? "#c99a2e" : "#888";

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
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            {promotion.discount_percent}% off · {promotion.plans?.name ?? "All plans"}
            {promotion.code ? ` · code ${promotion.code}` : " · applies automatically"}
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            Used {promotion.redemptions_count}
            {promotion.max_redemptions !== null ? ` / ${promotion.max_redemptions}` : ""} time
            {promotion.redemptions_count === 1 ? "" : "s"}
            {promotion.ends_at ? ` · expires ${new Date(promotion.ends_at).toLocaleDateString()}` : ""}
          </div>
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
          }}
        >
          {isActive ? "Turn off" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
