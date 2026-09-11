"use client";

import { useState, useTransition } from "react";
import { setMaintenanceSettingsAction } from "@/app/admin/actions";

type Settings = { is_enabled: boolean; message: string } | null;

// Angel: "if Im doing a system update, do not allow anybody to create an
// account or login, just let them know system is currently under
// maintenance and will be back in a few minutes." Flipping this ON
// immediately swaps every sign-in/sign-up page (clinic staff, patients,
// get-started, create-account) for a friendly "under maintenance" notice —
// this admin console itself stays reachable so the toggle can always be
// switched back off.
export function MaintenanceSettingsForm({ settings }: { settings: Settings }) {
  const [isEnabled, setIsEnabled] = useState(settings?.is_enabled ?? false);
  const [message, setMessage] = useState(
    settings?.message ?? "MyCareDesk is currently undergoing a quick system update. We'll be back in just a few minutes — thanks for your patience!"
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save(next: { isEnabled: boolean; message: string }) {
    setError(null);
    startTransition(async () => {
      try {
        await setMaintenanceSettingsAction(next);
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
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: isEnabled ? "crimson" : "#333" }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => {
              setIsEnabled(e.target.checked);
              save({ isEnabled: e.target.checked, message });
            }}
            disabled={pending}
          />
          Maintenance mode is {isEnabled ? "ON — sign-in and sign-up are blocked" : "off"}
        </label>
        <label>
          <div style={labelStyle}>Message shown to visitors</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => save({ isEnabled, message })}
            disabled={pending}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
        {saved && <div style={{ fontSize: 12, color: "#1a7f37" }}>Saved.</div>}
        {error && <div style={{ fontSize: 12, color: "crimson" }}>{error}</div>}
        {isEnabled && (
          <div style={{ fontSize: 12, color: "#c99a2e" }}>
            Turn this off as soon as your update is done — nobody can sign in or create an account while it's on
            (this admin console is unaffected).
          </div>
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
