"use client";

import { useState, useTransition } from "react";
import { saveThemePreferenceAction } from "./actions";

const OPTIONS: { value: "light" | "dark" | "system"; label: string; blurb: string }[] = [
  { value: "system", label: "Match system", blurb: "Follows your device or browser's light/dark setting automatically." },
  { value: "light", label: "Light", blurb: "Always use the light theme, regardless of your device setting." },
  { value: "dark", label: "Dark", blurb: "Always use the dark theme, regardless of your device setting." },
];

export function AppearanceForm({ initialTheme }: { initialTheme: "light" | "dark" | "system" }) {
  const [theme, setTheme] = useState(initialTheme);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function choose(value: "light" | "dark" | "system") {
    setTheme(value);
    setMessage(null);
    startTransition(async () => {
      try {
        await saveThemePreferenceAction(value);
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, display: "grid", gap: 10 }}>
      {OPTIONS.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${theme === opt.value ? "#0c1730" : "var(--input-border)"}`,
            background: theme === opt.value ? "rgba(12,23,48,0.04)" : "transparent",
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="theme"
            checked={theme === opt.value}
            onChange={() => choose(opt.value)}
            disabled={pending}
            style={{ marginTop: 3 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-heading)" }}>{opt.label}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{opt.blurb}</div>
          </div>
        </label>
      ))}
      {message && <div style={{ fontSize: 12.5, color: message.startsWith("Error") ? "crimson" : "#1a7f37" }}>{message}</div>}
    </div>
  );
}
