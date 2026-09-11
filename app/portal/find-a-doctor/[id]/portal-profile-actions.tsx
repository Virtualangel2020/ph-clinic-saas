import Link from "next/link";

const NAVY = "var(--brand-primary)";

// Booking + messaging CTAs for the in-portal provider profile. Unlike the
// public version (app/find-a-doctor/[id]/profile-actions.tsx), which must
// route an unknown visitor through /portal/login first, being on this page
// already proves the patient is signed in — so these go straight to the
// real portal flows, never through a login redirect. /portal/book/[id]
// already handles every booking style (slot booking, appointment-request,
// flexible-arrival, walk-in, or "not bookable online") on its own, so a
// single link covers all of them here.
export function PortalProfileActions({ provider, bookingType, messagingEnabled }: { provider: { id: string; full_name: string }; bookingType: string; messagingEnabled: boolean }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: "18px 20px", display: "grid", gap: 12 }}>
      {bookingType === "walk_in" && <p style={{ fontSize: 13, color: "#444", margin: 0 }}>No appointment needed — just walk in during clinic hours.</p>}
      {bookingType === "flexible" && <p style={{ fontSize: 13, color: "#444", margin: 0 }}>Contact the clinic directly to check current availability.</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href={`/portal/book/${provider.id}`}
          style={{ background: NAVY, color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 8, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          Book Appointment
        </Link>

        {messagingEnabled ? (
          <Link
            href={`/portal/messages/${provider.id}`}
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
    </div>
  );
}
