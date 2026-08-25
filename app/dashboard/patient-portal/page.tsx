import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";

// Patient Messages inbox (spec §29-34, Phase 5) — one row per patient
// who's messaged the CURRENTLY LOGGED-IN provider, newest activity first.
// Messaging is per-provider by design (a nurse or clinic_admin account
// simply won't have any threads here unless patients have been messaging
// them directly), so this reads provider_id = the logged-in profile's own
// id — never every provider's mail in the clinic. Replying happens from
// an existing thread; there's no "compose new" here since a thread only
// exists once a patient has reached out first (see provider_patient_messages).
export default async function PatientPortalPage() {
  const { supabase, profile } = await requireClinicMember();

  const { data: settingsRow } = await supabase
    .from("provider_patient_access_settings")
    .select("messaging_enabled")
    .eq("provider_id", profile.id)
    .maybeSingle();
  const { data: clinicRow } = await supabase.from("clinic_settings").select("default_messaging_enabled").eq("tenant_id", profile.tenant_id).maybeSingle();
  const messagingEnabled = settingsRow?.messaging_enabled ?? clinicRow?.default_messaging_enabled ?? false;

  const { data: messages } = await supabase
    .from("provider_patient_messages")
    .select("id, patient_id, sender_type, body, created_at, read_at, patients(first_name, last_name)")
    .eq("provider_id", profile.id)
    .order("created_at", { ascending: false });

  const byPatient = new Map<string, { patientId: string; patientName: string; lastMessage: any; unreadCount: number }>();
  for (const m of (messages as any[]) ?? []) {
    const patientId = m.patient_id;
    const patientName = m.patients ? `${m.patients.first_name} ${m.patients.last_name}` : "Patient";
    if (!byPatient.has(patientId)) {
      byPatient.set(patientId, { patientId, patientName, lastMessage: m, unreadCount: 0 });
    }
    if (m.sender_type === "patient" && !m.read_at) {
      byPatient.get(patientId)!.unreadCount += 1;
    }
  }
  const conversations = Array.from(byPatient.values());

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Patient Messages</h1>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>Conversations your patients have started with you through the Patient Portal.</p>

      {!messagingEnabled && (
        <div style={{ background: "#f4f4f5", border: "1px solid #e2e2e5", borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: "#666", marginBottom: 18 }}>
          Messaging is currently off for your profile.{" "}
          <Link href="/dashboard/settings/patient-access/messaging" style={{ color: "var(--text-heading, #0c1730)", fontWeight: 600 }}>
            Turn it on in Patient Access settings →
          </Link>
        </div>
      )}

      {conversations.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13.5 }}>No conversations yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {conversations.map((c) => (
            <Link
              key={c.patientId}
              href={`/dashboard/patient-portal/${c.patientId}`}
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                background: "white",
                border: c.unreadCount > 0 ? "1px solid #e6c66b" : "1px solid #e2e2e5",
                borderRadius: 10,
                padding: "14px 18px",
                textDecoration: "none",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#0c1730" }}>{c.patientName}</div>
                <div style={{ fontSize: 12.5, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
                  {c.lastMessage.sender_type === "provider" ? "You: " : ""}
                  {c.lastMessage.body}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 11.5, color: "#999" }}>{new Date(c.lastMessage.created_at).toLocaleDateString()}</div>
                {c.unreadCount > 0 && (
                  <span
                    style={{
                      minWidth: 22,
                      height: 22,
                      padding: "0 6px",
                      borderRadius: 999,
                      background: "#c0392b",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {c.unreadCount > 99 ? "99+" : c.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
