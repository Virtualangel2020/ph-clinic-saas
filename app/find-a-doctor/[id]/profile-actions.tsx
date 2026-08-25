"use client";

import { useState } from "react";
import Link from "next/link";
import { AppointmentRequestForm } from "../appointment-request-form";

const NAVY = "#0c1730";

// Booking + messaging call-to-action for the public profile (spec §29-34,
// §49-54). Anonymous visitors get a request/inquiry path (existing
// public_appointment_requests infra) for appointment-capable providers;
// real-time slot booking and messaging both require being a known
// Patient Portal patient, so those route to Portal login rather than
// pretending an anonymous stranger can book/message directly — that's a
// correct requirement, not a broken link. The locked-messaging wording
// below is verbatim per spec: never let a patient click into a broken
// page when messaging is off.
export function ProfileActions({ provider, bookingType, messagingEnabled }: { provider: { id: string; full_name: string }; bookingType: string; messagingEnabled: boolean }) {
  const [requesting, setRequesting] = useState(false);
  const canRequest = bookingType === "appointment" || bookingType === "both" || bookingType === "appointment_request";

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: "18px 20px", display: "grid", gap: 12 }}>
      {bookingType === "walk_in" && <p style={{ fontSize: 13, color: "#444", margin: 0 }}>No appointment needed — just walk in during clinic hours.</p>}
      {bookingType === "flexible" && <p style={{ fontSize: 13, color: "#444", margin: 0 }}>Contact the clinic directly to check current availability.</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {canRequest && (
          <>
            <Link
              href={`/portal/login?next=${encodeURIComponent(`/portal/book/${provider.id}`)}`}
              style={{ background: NAVY, color: "#e6c66b", fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 8, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Book Appointment
            </Link>
            <button
              onClick={() => setRequesting(true)}
              style={{ background: "white", color: NAVY, fontWeight: 600, fontSize: 13, padding: "10px 18px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Request Appointment (no account needed)
            </button>
          </>
        )}

        {messagingEnabled ? (
          <Link
            href={`/portal/login?next=${encodeURIComponent(`/portal/messages/${provider.id}`)}`}
            style={{ background: "white", color: NAVY, fontWeight: 600, fontSize: 13, padding: "10px 18px", borderRadius: 8, border: "1px solid #ddd", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Send a Message
          </Link>
        ) : (
          <span
            title="Messaging is currently unavailable for this provider."
            style={{ background: "#f4f4f5", color: "#999", fontWeight: 600, fontSize: 13, padding: "10px 18px", borderRadius: 8, border: "1px solid #e2e2e5", whiteSpace: "nowrap" }}
          >
            🔒 Send a Message
          </span>
        )}
      </div>
      {!messagingEnabled && <p style={{ fontSize: 11.5, color: "#999", margin: 0 }}>Messaging is currently unavailable for this provider.</p>}

      {requesting && <AppointmentRequestForm provider={provider} onClose={() => setRequesting(false)} />}
    </div>
  );
}
