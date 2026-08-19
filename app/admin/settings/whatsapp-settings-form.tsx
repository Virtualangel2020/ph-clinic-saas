"use client";

import { useState, useTransition } from "react";
import { setWhatsappSettingsAction } from "@/app/admin/actions";

type Settings = { phone_number: string | null; default_message: string; is_enabled: boolean } | null;

export function WhatsappSettingsForm({ settings }: { settings: Settings }) {
  const [phoneNumber, setPhoneNumber] = useState(settings?.phone_number ?? "");
  const [defaultMessage, setDefaultMessage] = useState(
    settings?.default_message ?? "Hi Virtual Angel Systems, I need help choosing an AngelClinic package."
  );
  const [isEnabled, setIsEnabled] = useState(settings?.is_enabled ?? false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await setWhatsappSettingsAction({ phoneNumber: phoneNumber.trim(), defaultMessage: defaultMessage.trim(), isEnabled });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20, maxWidth: 480 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          <div style={labelStyle}>WhatsApp number (with country code, e.g. 639171234567 — no + or spaces)</div>
          <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} onBlur={save} disabled={pending} style={inputStyle} />
        </label>
        <label>
          <div style={labelStyle}>Default prefilled message</div>
          <textarea value={defaultMessage} onChange={(e) => setDefaultMessage(e.target.value)} onBlur={save} disabled={pending} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => {
              setIsEnabled(e.target.checked);
              startTransition(async () => {
                try {
                  await setWhatsappSettingsAction({ phoneNumber: phoneNumber.trim(), defaultMessage: defaultMessage.trim(), isEnabled: e.target.checked });
                } catch (err: any) {
                  setError(err.message);
                }
              });
            }}
          />
          Show the WhatsApp button to customers
        </label>
        {saved && <div style={{ fontSize: 12, color: "#1a7f37" }}>Saved.</div>}
        {error && <div style={{ fontSize: 12, color: "crimson" }}>{error}</div>}
        {isEnabled && !phoneNumber.trim() && (
          <div style={{ fontSize: 12, color: "#c99a2e" }}>Add a number above — the button won't show without one, even while enabled.</div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 13,
  fontFamily: "inherit",
};
