"use client";

import { useState, useTransition } from "react";
import { setEmailProviderSettingsAction } from "@/app/admin/actions";

type Settings = { provider: string; has_api_key: boolean; from_email: string | null; from_name: string; is_enabled: boolean } | null;

export function EmailProviderSettingsForm({ settings }: { settings: Settings }) {
  const [provider, setProvider] = useState(settings?.provider ?? "resend");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(settings?.from_email ?? "");
  const [fromName, setFromName] = useState(settings?.from_name ?? "AngelClinic");
  const [isEnabled, setIsEnabled] = useState(settings?.is_enabled ?? false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save(overrideEnabled?: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setEmailProviderSettingsAction({
          provider,
          apiKey,
          fromEmail: fromEmail.trim(),
          fromName: fromName.trim(),
          isEnabled: overrideEnabled ?? isEnabled,
        });
        setApiKey("");
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
          <div style={labelStyle}>Provider</div>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} onBlur={() => save()} style={inputStyle}>
            <option value="resend">Resend</option>
            <option value="sendgrid">SendGrid</option>
            <option value="postmark">Postmark</option>
            <option value="smtp">Custom SMTP</option>
          </select>
        </label>
        <label>
          <div style={labelStyle}>API key {settings?.has_api_key && <span style={{ color: "#1a7f37", fontWeight: 400 }}>(a key is currently saved — leave blank to keep it)</span>}</div>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={() => save()} placeholder={settings?.has_api_key ? "••••••••••••" : "Paste API key"} disabled={pending} style={inputStyle} />
        </label>
        <label>
          <div style={labelStyle}>From email</div>
          <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} onBlur={() => save()} placeholder="notifications@angelclinic.ph" disabled={pending} style={inputStyle} />
        </label>
        <label>
          <div style={labelStyle}>From name</div>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} onBlur={() => save()} disabled={pending} style={inputStyle} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => {
              setIsEnabled(e.target.checked);
              save(e.target.checked);
            }}
          />
          Live — actually send email through this provider
        </label>
        {saved && <div style={{ fontSize: 12, color: "#1a7f37" }}>Saved.</div>}
        {error && <div style={{ fontSize: 12, color: "crimson" }}>{error}</div>}
        {isEnabled && !settings?.has_api_key && !apiKey && (
          <div style={{ fontSize: 12, color: "#c99a2e" }}>No API key saved yet — add one above before this can actually send anything.</div>
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
