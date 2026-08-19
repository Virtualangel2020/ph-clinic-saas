"use client";

import { useState, useTransition } from "react";
import { setCommerceSettingsAction } from "@/app/admin/actions";

type Settings = { offer_monthly: boolean; offer_yearly: boolean; offer_one_time: boolean } | null;

export function CommerceSettingsForm({ settings }: { settings: Settings }) {
  const [offerMonthly, setOfferMonthly] = useState(settings?.offer_monthly ?? true);
  const [offerYearly, setOfferYearly] = useState(settings?.offer_yearly ?? true);
  const [offerOneTime, setOfferOneTime] = useState(settings?.offer_one_time ?? true);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save(next: { monthly: boolean; yearly: boolean; oneTime: boolean }) {
    setError(null);
    startTransition(async () => {
      try {
        await setCommerceSettingsAction({
          offerMonthly: next.monthly,
          offerYearly: next.yearly,
          offerOneTime: next.oneTime,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20, maxWidth: 480 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={offerMonthly}
            disabled={pending}
            onChange={(e) => {
              setOfferMonthly(e.target.checked);
              save({ monthly: e.target.checked, yearly: offerYearly, oneTime: offerOneTime });
            }}
          />
          Offer Monthly billing
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={offerYearly}
            disabled={pending}
            onChange={(e) => {
              setOfferYearly(e.target.checked);
              save({ monthly: offerMonthly, yearly: e.target.checked, oneTime: offerOneTime });
            }}
          />
          Offer Yearly billing
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={offerOneTime}
            disabled={pending}
            onChange={(e) => {
              setOfferOneTime(e.target.checked);
              save({ monthly: offerMonthly, yearly: offerYearly, oneTime: e.target.checked });
            }}
          />
          Offer Lifetime (one-time payment) billing
        </label>
        {saved && <div style={{ fontSize: 12, color: "#1a7f37" }}>Saved.</div>}
        {error && <div style={{ fontSize: 12, color: "crimson" }}>{error}</div>}
        <p style={{ fontSize: 11, color: "#999", margin: 0 }}>
          Unchecking a billing option hides it immediately from the public pricing page and checkout — existing
          clients already on that cycle are unaffected. You can turn it back on anytime.
        </p>
      </div>
    </div>
  );
}
