import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { getCommunicationsData } from "@/lib/communications/get-communications-data";
import { ComposeWidget } from "./compose-widget";

// Communications — replaces the old "Phase 7" placeholder. Email + SMS are
// genuinely wired: sending goes through the same sendPortalEmail/
// sendPortalSms functions (lib/patient-portal/send.ts) the Patient Portal
// invite flow already uses in production, and every send is logged to the
// new patient_communications table for a real history (see
// lib/communications/get-communications-data.ts). WhatsApp has no
// integration built yet (no Meta WhatsApp Business API connection exists),
// and Telephone Encounters has no call-logging data model yet — both are
// shown honestly as "not connected" tabs rather than faked, matching how
// Settings → Payments already handles "PayMongo Not Configured".
export default async function CommunicationsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supabase, profile } = await requireClinicMember();
  const data = await getCommunicationsData(supabase, profile.tenant_id as string);

  const tab = searchParams.tab === "calls" || searchParams.tab === "whatsapp" ? searchParams.tab : "messages";

  const TABS: { key: string; label: string }[] = [
    { key: "messages", label: "Email & SMS" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "calls", label: "Telephone Encounters" },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Communications</h1>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 0 }}>
          Reach a patient directly by email or SMS, and see a history of everything sent from your clinic.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, margin: "16px 0 22px", borderBottom: "1px solid var(--card-border)" }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "messages" ? "/dashboard/communications" : `/dashboard/communications?tab=${t.key}`}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: tab === t.key ? "var(--text-heading)" : "#888",
              borderBottom: tab === t.key ? "2px solid #0c1730" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "messages" && <MessagesTab data={data} />}
      {tab === "whatsapp" && (
        <NotConnected
          title="WhatsApp"
          body="WhatsApp isn't connected yet — it needs a Meta WhatsApp Business API account linked to this clinic before messages can send. Reach out via Settings → Customer Care when you're ready to set that up."
        />
      )}
      {tab === "calls" && (
        <NotConnected
          title="Telephone Encounters"
          body="Call logging isn't built yet — there's no place to record telephone encounters as their own entries today. This needs its own data model and screen, planned as a separate build."
        />
      )}
    </div>
  );
}

function MessagesTab({ data }: { data: Awaited<ReturnType<typeof getCommunicationsData>> }) {
  const STATUS_PILL: Record<string, { label: string; color: string }> = {
    sent: { label: "Sent", color: "#1a7f37" },
    failed: { label: "Failed", color: "#a12a2a" },
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <ProviderStatusPill label="Email (Resend)" configured={data.email.configured} />
        <ProviderStatusPill label="SMS (Semaphore)" configured={data.sms.configured} />
        <Link href="/dashboard/settings" style={{ fontSize: 12.5, color: "#2563eb" }}>
          Settings →
        </Link>
      </div>

      {(!data.email.configured || !data.sms.configured) && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#7a5c12", marginBottom: 20 }}>
          {!data.email.configured && !data.sms.configured
            ? "Neither Email nor SMS is turned on at the platform level yet — messages sent below will show up in history as failed until Resend and/or Semaphore is configured with a real API key in Admin → Settings."
            : `${!data.email.configured ? "Email" : "SMS"} isn't turned on at the platform level yet — that channel will show as failed until it's configured with a real API key in Admin → Settings.`}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Sent Today" value={String(data.sentToday)} color="#1a7f37" />
        <StatCard label="Sent This Month" value={String(data.sentThisMonth)} />
        <StatCard label="Recent Failures" value={String(data.failedRecentCount)} color={data.failedRecentCount > 0 ? "#a12a2a" : undefined} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <ComposeWidget emailConfigured={data.email.configured} smsConfigured={data.sms.configured} />
      </div>

      <Section title="Recent Messages">
        {data.recent.length > 0 ? (
          <Table
            headers={["Date", "Patient", "Channel", "To", "Subject / Message", "Status"]}
            rows={data.recent.map((r) => [
              new Date(r.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }),
              <Link key={r.id} href={`/dashboard/patients/${r.patientId}`} style={{ color: "var(--text-heading)", fontWeight: 600, textDecoration: "none" }}>
                {r.patientName}
              </Link>,
              r.channel === "email" ? "Email" : "SMS",
              r.toAddress,
              r.subject || r.message,
              <div key={r.id}>
                <StatusPill tone={STATUS_PILL[r.status]?.color ?? "#999"}>{STATUS_PILL[r.status]?.label ?? r.status}</StatusPill>
                {r.status === "failed" && r.error && <div style={{ fontSize: 11, color: "#a12a2a", marginTop: 3, maxWidth: 220 }}>{r.error}</div>}
              </div>,
            ])}
          />
        ) : (
          <EmptyState text="No messages sent yet — anything you send above will show up here." />
        )}
      </Section>
    </div>
  );
}

function NotConnected({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
      <div
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          color: "#666",
          background: "#f2f2f2",
          border: "1px solid #ddd",
          borderRadius: 999,
          padding: "3px 10px",
          marginBottom: 12,
        }}
      >
        Not Connected
      </div>
      <p style={{ color: "#555", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{body}</p>
    </div>
  );
}

function ProviderStatusPill({ label, configured }: { label: string; configured: boolean }) {
  const color = configured ? { bg: "#eaf7ee", border: "#bfe6c9", fg: "#1a7f37" } : { bg: "#f2f2f2", border: "#ddd", fg: "#666" };
  return (
    <span style={{ fontSize: 12, fontWeight: 700, background: color.bg, border: `1px solid ${color.border}`, color: color.fg, borderRadius: 999, padding: "4px 12px" }}>
      {label} — {configured ? "Live" : "Not Configured"}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? "var(--text-heading)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: tone, background: `${tone}15`, border: `1px solid ${tone}40`, borderRadius: 999, padding: "3px 9px" }}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ padding: 16, color: "#888", fontSize: 13 }}>{text}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
        <thead>
          <tr style={{ background: "#fafafa", textAlign: "left" }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: "10px 16px", fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid #eee" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 16px", whiteSpace: j === 4 ? "normal" : "nowrap", maxWidth: j === 4 ? 260 : undefined, overflow: j === 4 ? "hidden" : undefined, textOverflow: j === 4 ? "ellipsis" : undefined }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
