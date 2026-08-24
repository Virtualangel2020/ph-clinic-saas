"use client";

import { useState, useTransition } from "react";
import { saveLanguagePreferenceAction } from "./actions";

const OPTIONS: { value: "en" | "fil"; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
];

export function LanguageForm({ initialLanguage }: { initialLanguage: "en" | "fil" }) {
  const [language, setLanguage] = useState(initialLanguage);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function choose(value: "en" | "fil") {
    setLanguage(value);
    setMessage(null);
    startTransition(async () => {
      try {
        await saveLanguagePreferenceAction(value);
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, display: "grid", gap: 14 }}>
      <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#7a5c12" }}>
        This saves your preference for when full translation is available. The interface itself stays in English for
        now — translating every screen is a larger project than this preference toggle.
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${language === opt.value ? "#0c1730" : "var(--input-border)"}`,
              background: language === opt.value ? "rgba(12,23,48,0.04)" : "transparent",
              cursor: "pointer",
            }}
          >
            <input type="radio" name="language" checked={language === opt.value} onChange={() => choose(opt.value)} disabled={pending} />
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-heading)" }}>{opt.label}</div>
          </label>
        ))}
      </div>
      {message && <div style={{ fontSize: 12.5, color: message.startsWith("Error") ? "crimson" : "#1a7f37" }}>{message}</div>}
    </div>
  );
}
