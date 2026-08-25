import Link from "next/link";
import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { BackLink } from "@/components/back-link";

type ThreadRow = {
  provider_id: string;
  provider_name: string;
  provider_title: string | null;
  last_body: string;
  last_sender_type: "patient" | "provider";
  last_created_at: string;
  unread_count: number;
};

// My Messages (spec §29-34) — one row per provider you've ever messaged,
// newest activity first. Mirrors the admin Customer Care inbox pattern:
// a provider you haven't messaged yet simply doesn't show up here — you
// start a thread from that provider's profile page instead.
export default async function PortalMessagesPage() {
  const { supabase } = await requirePatientPortal();
  const { data } = await supabase.rpc("portal_list_message_threads");
  const threads = (data as ThreadRow[]) ?? [];

  return (
    <PortalShell>
      <BackLink href="/portal" label="Portal Home" />
      <h1 style={{ fontSize: 21, marginBottom: 4 }}>My Messages</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Conversations with your providers. To start a new one, visit a provider's profile from{" "}
        <Link href="/find-a-doctor" style={{ color: "var(--text-heading, #0c1730)", fontWeight: 600 }}>
          Find a Doctor
        </Link>
        .
      </p>

      {threads.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13.5 }}>No conversations yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {threads.map((t) => (
            <Link
              key={t.provider_id}
              href={`/portal/messages/${t.provider_id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                background: "white",
                border: t.unread_count > 0 ? "1px solid #e6c66b" : "1px solid #eee",
                borderRadius: 10,
                padding: "14px 18px",
                textDecoration: "none",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#0c1730" }}>
                  {t.provider_title ? `${t.provider_title} ` : ""}
                  {t.provider_name}
                </div>
                <div style={{ fontSize: 12.5, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
                  {t.last_sender_type === "patient" ? "You: " : ""}
                  {t.last_body}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 11.5, color: "#999" }}>{new Date(t.last_created_at).toLocaleDateString()}</div>
                {t.unread_count > 0 && (
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
                    {t.unread_count > 99 ? "99+" : t.unread_count}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
