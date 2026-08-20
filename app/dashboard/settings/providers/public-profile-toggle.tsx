"use client";

import { useState, useTransition } from "react";
import { setPublicProviderProfileAction } from "../actions";

type Profile = {
  public_directory_enabled: boolean | null;
  public_bio: string | null;
  public_languages: string[] | null;
  public_consultation_type: string | null;
  public_consultation_fee_php: number | null;
  public_booking_mode: string | null;
};

export function PublicProfileToggle({ profile }: { profile: Profile }) {
  const [enabled, setEnabled] = useState(profile.public_directory_enabled ?? false);
  const [bio, setBio] = useState(profile.public_bio ?? "");
  const [languages, setLanguages] = useState((profile.public_languages ?? []).join(", "));
  const [consultationType, setConsultationType] = useState(profile.public_consultation_type ?? "in_person");
  const [fee, setFee] = useState(profile.public_consultation_fee_php?.toString() ?? "");
  const [bookingMode, setBookingMode] = useState(profile.public_booking_mode ?? "none");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      try {
        await setPublicProviderProfileAction({
          enabled,
          bio,
          languages: languages.split(",").map((l) => l.trim()).filter(Boolean),
          consultationType,
          consultationFeePhp: fee ? Number(fee) : null,
          bookingMode,
        });
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Public directory listing</h2>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
        Optional. Turn this on to appear on AngelClinic's public "Find a Doctor" page. Off by default — nothing
        about you is shown publicly unless you enable it here.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Show my profile publicly
      </label>

      {enabled && (
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <textarea
            placeholder="Short bio shown to patients"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, minHeight: 60, fontFamily: "inherit" }}
          />
          <input
            placeholder="Languages spoken (comma-separated)"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select value={consultationType} onChange={(e) => setConsultationType(e.target.value)} style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}>
              <option value="in_person">In-person</option>
              <option value="telehealth">Telehealth</option>
              <option value="both">Both</option>
            </select>
            <input
              type="number"
              placeholder="Consultation fee (₱)"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#333", display: "block", marginBottom: 4 }}>Public booking</label>
            <select value={bookingMode} onChange={(e) => setBookingMode(e.target.value)} style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, width: "100%" }}>
              <option value="none">Don't accept public appointment requests — listing only</option>
              <option value="request">Accept appointment requests (clinic confirms manually)</option>
              <option value="real_time" disabled>
                Real-time booking (not available yet)
              </option>
            </select>
          </div>
        </div>
      )}

      {message && <p style={{ fontSize: 12.5, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginBottom: 10 }}>{message}</p>}
      <button
        onClick={save}
        disabled={pending}
        style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 8, border: "none", cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
