"use client";

import { useState, useTransition } from "react";
import { updateBillingSettingsAction } from "@/app/admin/actions";

type Settings = {
  grace_period_days: number;
  data_retention_days: number;
  default_upgrade_credit_policy: string;
  reminder_days_before_billing: number[];
  reminder_days_after_failed_payment: number;
  provider_volume_discount_threshold: number;
  provider_volume_discount_percent: number;
};

export function BillingSettingsForm({ settings }: { settings: Settings }) {
  const [gracePeriodDays, setGracePeriodDays] = useState(String(settings.grace_period_days));
  const [dataRetentionDays, setDataRetentionDays] = useState(String(settings.data_retention_days));
  const [policy, setPolicy] = useState(settings.default_upgrade_credit_policy);
  const [reminders, setReminders] = useState(settings.reminder_days_before_billing.join(", "));
  const [reminderAfterFailed, setReminderAfterFailed] = useState(String(settings.reminder_days_after_failed_payment));
  const [volumeDiscountThreshold, setVolumeDiscountThreshold] = useState(String(settings.provider_volume_discount_threshold));
  const [volumeDiscountPercent, setVolumeDiscountPercent] = useState(String(settings.provider_volume_discount_percent));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      try {
        await updateBillingSettingsAction({
          gracePeriodDays: Number(gracePeriodDays),
          dataRetentionDays: Number(dataRetentionDays),
          defaultUpgradeCreditPolicy: policy,
          reminderDaysBeforeBilling: reminders
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => !isNaN(n)),
          reminderDaysAfterFailedPayment: Number(reminderAfterFailed),
          providerVolumeDiscountThreshold: Number(volumeDiscountThreshold),
          providerVolumeDiscountPercent: Number(volumeDiscountPercent),
        });
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={label}>Grace period (days after a missed payment before suspension)</label>
          <input type="number" min={0} value={gracePeriodDays} onChange={(e) => setGracePeriodDays(e.target.value)} style={input} />
        </div>
        <div>
          <label style={label}>Data retention after cancellation (days)</label>
          <input type="number" min={0} value={dataRetentionDays} onChange={(e) => setDataRetentionDays(e.target.value)} style={input} />
        </div>
        <div>
          <label style={label}>Default upgrade-credit policy</label>
          <select value={policy} onChange={(e) => setPolicy(e.target.value)} style={input}>
            <option value="none">No credit — pay full new price</option>
            <option value="full">Full credit from latest payment</option>
            <option value="partial">Partial credit</option>
            <option value="prorated">Prorated credit</option>
            <option value="custom">Custom (decide per case)</option>
          </select>
        </div>
        <div>
          <label style={label}>Reminder days before billing (comma-separated)</label>
          <input value={reminders} onChange={(e) => setReminders(e.target.value)} placeholder="7, 3" style={input} />
        </div>
        <div>
          <label style={label}>Reminder days after a failed payment</label>
          <input type="number" min={0} value={reminderAfterFailed} onChange={(e) => setReminderAfterFailed(e.target.value)} style={input} />
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#999", marginBottom: 14 }}>
        Note: these are the rules the system will follow. Actually emailing/texting reminders needs an email or SMS
        provider connected — that's a separate piece not built yet.
      </p>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 4 }}>Provider volume discount</div>
        <p style={{ fontSize: 11, color: "#999", marginBottom: 10 }}>
          Once a clinic's <strong>additional</strong> providers (beyond the one included in the base plan) reach the
          threshold below, this percentage is discounted off the additional-provider fee only — the ₱6,990 base
          subscription is never discounted. Example: threshold 5, discount 10% → 5 extra providers (normally
          ₱7,450/mo) become ₱6,705/mo, for a ₱13,695/mo total.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={label}>Additional-provider threshold (set discount % to 0 to disable)</label>
            <input
              type="number"
              min={0}
              value={volumeDiscountThreshold}
              onChange={(e) => setVolumeDiscountThreshold(e.target.value)}
              style={input}
            />
          </div>
          <div>
            <label style={label}>Discount on additional-provider fee (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={volumeDiscountPercent}
              onChange={(e) => setVolumeDiscountPercent(e.target.value)}
              style={input}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={pending} style={submitBtn}>
          {pending ? "Saving..." : "Save billing defaults"}
        </button>
        {message && <span style={{ fontSize: 13, color: message.startsWith("Error") ? "crimson" : "#1a7f37" }}>{message}</span>}
      </div>
    </div>
  );
}

const input: React.CSSProperties = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 };
const submitBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
