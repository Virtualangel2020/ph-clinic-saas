import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";
import { STATUS_GLYPH, STATUS_LABEL, statusColor } from "./calendar/status-constants";

// Overrides the root manifest so /dashboard installs as its own app
// ("Angel Clinic — Staff"), separate from the Super Admin dashboard.
export const metadata: Metadata = {
  manifest: "/api/pwa/staff-manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AC Staff",
  },
};

const money = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Card({ title, children, href, hrefLabel }: { title: string; children: React.ReactNode; href?: string; hrefLabel?: string }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column" }}>
      <h2 style={{ fontSize: 12.5, marginTop: 0, marginBottom: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</h2>
      <div style={{ flex: 1 }}>{children}</div>
      {href && (
        <Link href={href} style={{ fontSize: 12, color: "#2563eb", marginTop: 10, display: "inline-block" }}>
          {hrefLabel ?? "View →"}
        </Link>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-heading)", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#999", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StatRow({ stats }: { stats: { value: string | number; label: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
      {stats.map((s, i) => (
        <Stat key={i} value={s.value} label={s.label} />
      ))}
    </div>
  );
}

function Pill({ children, tone = "#666" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: tone, background: `${tone}15`, border: `1px solid ${tone}40`, borderRadius: 999, padding: "2px 8px" }}>
      {children}
    </span>
  );
}

// Protected page. Deliberately queries user_profiles and tenants with
// the LOGGED-IN USER'S OWN session (no service-role key anywhere in
// this app) — if tenant isolation is working, this user can only ever
// see their own profile and their own tenant, never another clinic's.
//
// This is the operational home screen: role-based (clinic-wide view for
// admin/staff/reception vs. an own-workload-focused view for a doctor)
// and walk-in-mode-aware (appointment-funnel widgets give way to
// walk-in/queue/wait-time widgets when the clinic runs walk-in only).
// "What's included in your system" lives under Settings → Subscription
// now, not here — this page is strictly operational, not a plan summary.
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, full_name, role, tenant_id, tenants(name, status)")
    .eq("id", user!.id)
    .maybeSingle();

  // Platform admins have their own dashboard — send them straight there
  // rather than showing them the customer view.
  if (profile?.role === "platform_admin") {
    redirect("/admin");
  }

  const tenant = (profile as any)?.tenants ?? null;

  // No tenant yet (they signed up but haven't paid/finished checkout) —
  // show a clear next step, not an empty debug page. If they already
  // started picking a plan, /get-started resumes it automatically, so
  // the label just reflects that instead of implying they're starting
  // from zero.
  if (!profile?.tenant_id) {
    const { data: pendingRequest } = await supabase
      .from("requests")
      .select("id")
      .eq("user_id", user!.id)
      .eq("status", "pending")
      .maybeSingle();

    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <BrandHeader />
        </div>
        <p style={{ color: "#555", marginBottom: 24 }}>Signed in as {user!.email}</p>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginTop: 0, marginBottom: 8 }}>
            {pendingRequest ? "Your AngelClinic system isn't set up yet" : "You haven't activated an AngelClinic system yet"}
          </h1>
          <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
            {pendingRequest
              ? "You started choosing a plan but haven't completed payment. Pick up right where you left off — nothing you selected was lost."
              : "Pick a plan and pay, and your clinic's portal unlocks automatically — no waiting on approval."}
          </p>
          <Link
            href="/get-started"
            style={{ display: "inline-block", padding: "11px 22px", borderRadius: 8, background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
          >
            {pendingRequest ? "Continue setting up your system →" : "Choose a Plan →"}
          </Link>
        </div>
      </main>
    );
  }

  const isDoctor = profile.role === "doctor";
  const isClinicAdmin = profile.role === "clinic_admin";

  const data = await getDashboardData(supabase, profile.tenant_id, {
    id: profile.id,
    role: profile.role,
    full_name: profile.full_name,
  });

  const showRevenue = isClinicAdmin || isDoctor;
  const showApptFunnel = !data.walkInOnly;

  // Rendered inside the EMR shell (app/dashboard/layout.tsx) once a tenant
  // exists — no BrandHeader/nav here, the shell already provides it.
  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
      <p style={{ color: "#555", marginBottom: 20, fontSize: 13 }}>{tenant?.name ?? data.clinicName ?? "Your clinic"} · {user!.email}</p>

      {tenant?.status && tenant.status !== "active" && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#7a5c12", marginBottom: 20 }}>
          Your clinic's status is currently <strong>{tenant.status.replace(/_/g, " ")}</strong>. Contact support if this looks wrong.
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          { href: "/dashboard/patients/new", label: "Register Patient" },
          { href: "/dashboard/calendar", label: "New Walk-In" },
          { href: "/dashboard/calendar", label: "Book Appointment" },
          { href: "/dashboard/patients", label: "Search Patient" },
          { href: "/dashboard/patients", label: "Start Encounter" },
        ].map((a, i) => (
          <Link
            key={i}
            href={a.href}
            style={{ fontSize: 12.5, fontWeight: 700, color: "#0c1730", background: "#f3e9c8", border: "1px solid #e6c66b", borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}
          >
            {a.label}
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
        {/* Today's Patients */}
        <Card title={isDoctor ? "My Patients Today" : "Today's Patients"}>
          <StatRow
            stats={[
              { value: data.patientsToday, label: "total" },
              { value: data.walkInsToday, label: "walk-ins" },
            ]}
          />
        </Card>

        {/* New Patients Today */}
        <Card title="New Patients Today">
          <StatRow stats={[{ value: data.newPatientsToday, label: "registered today" }]} />
        </Card>

        {/* Current Queue */}
        <Card title={isDoctor ? "My Queue" : "Current Queue"} href="/dashboard/calendar" hrefLabel="Open calendar →">
          <StatRow
            stats={[
              { value: data.queue.waiting, label: "waiting" },
              { value: data.queue.inConsultation, label: "in consultation" },
              { value: data.queue.completed, label: "completed" },
            ]}
          />
          {data.walkInOnly && data.avgWaitMinutes != null && (
            <p style={{ fontSize: 11.5, color: "#999", marginTop: 10, marginBottom: 0 }}>Avg. current wait: ~{data.avgWaitMinutes} min</p>
          )}
        </Card>

        {/* Appointments Today — hidden in walk-in-only mode */}
        {showApptFunnel && (
          <Card title="Appointments Today">
            <StatRow
              stats={[
                { value: data.apptBuckets.confirmed, label: "confirmed" },
                { value: data.apptBuckets.pending, label: "pending" },
                { value: data.apptBuckets.cancelled, label: "cancelled" },
                { value: data.apptBuckets.noShow, label: "no-show" },
              ]}
            />
          </Card>
        )}

        {/* Walk-in-only mode emphasis: waiting time front and center */}
        {data.walkInOnly && (
          <Card title="Waiting Time">
            <Stat value={data.avgWaitMinutes != null ? `${data.avgWaitMinutes}m` : "—"} label="avg. current wait" />
          </Card>
        )}

        {/* Follow-ups Due */}
        <Card title={isDoctor ? "My Follow-ups Due" : "Follow-ups Due"}>
          <StatRow
            stats={[
              { value: data.followUpsDue.overdue.length, label: "overdue" },
              { value: data.followUpsDue.today.length, label: "today" },
              { value: data.followUpsDue.tomorrow.length, label: "tomorrow" },
            ]}
          />
          {(data.followUpsDue.overdue.length > 0 || data.followUpsDue.today.length > 0) && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {[...data.followUpsDue.overdue, ...data.followUpsDue.today].slice(0, 4).map((f) => (
                <Link key={f.id} href={`/dashboard/patients/${f.patientId}?tab=follow_ups`} style={{ fontSize: 12, color: "#333", textDecoration: "none" }}>
                  <span style={{ color: f.dueDate < data.today ? "#a12a2a" : "#8a6100", fontWeight: 700 }}>●</span> {f.patientName}
                  {f.reason ? ` — ${f.reason}` : ""}
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Results Requiring Attention */}
        <Card title={isDoctor ? "My Results Requiring Attention" : "Results Requiring Attention"}>
          <Stat value={data.resultsRequiringAttentionCount} label="new / flagged" />
          {data.resultsRequiringAttention.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {data.resultsRequiringAttention.slice(0, 4).map((r) => (
                <Link key={r.id} href={`/dashboard/patients/${r.patientId}?tab=orders_results`} style={{ fontSize: 12, color: "#333", textDecoration: "none" }}>
                  {r.patientName} — <span style={{ color: "#999" }}>{r.label}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Patient Messages */}
        <Card title={isDoctor ? "My Messages" : "Patient Messages"} href="/dashboard/patient-portal" hrefLabel="Open messages →">
          <Stat value={data.unreadMessages} label="unread" />
        </Card>

        {/* Referrals — clinic-wide only; doctors see their own patient work elsewhere */}
        {!isDoctor && (
          <Card title="Referrals" href="/dashboard/referrals?view=incoming&status=pending" hrefLabel="View referrals →">
            <Stat value={data.incomingReferrals} label="incoming pending" />
          </Card>
        )}

        {/* Revenue Today — clinic_admin (clinic total) or doctor (own only) */}
        {showRevenue && (
          <Card title={isDoctor ? "My Revenue Today" : "Revenue Today"}>
            <Stat value={data.revenueToday != null ? money(data.revenueToday) : "—"} label="collected today" />
          </Card>
        )}
      </div>

      {/* Provider Overview — clinic-wide roles only, never on a doctor's own dashboard */}
      {!isDoctor && data.providerOverview.length > 0 && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 18, marginBottom: 16, overflowX: "auto" }}>
          <h2 style={{ fontSize: 12.5, marginTop: 0, marginBottom: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>Provider Overview</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#999", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={{ padding: "4px 8px 8px 0", fontWeight: 700 }}>Provider</th>
                <th style={{ padding: "4px 8px 8px", fontWeight: 700 }}>Patients Today</th>
                <th style={{ padding: "4px 8px 8px", fontWeight: 700 }}>Waiting</th>
                <th style={{ padding: "4px 8px 8px", fontWeight: 700 }}>Completed</th>
                <th style={{ padding: "4px 8px 8px", fontWeight: 700 }}>Next Available</th>
              </tr>
            </thead>
            <tbody>
              {data.providerOverview.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--card-border)" }}>
                  <td style={{ padding: "10px 8px 10px 0", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "10px 8px" }}>{p.patientsToday}</td>
                  <td style={{ padding: "10px 8px" }}>{p.waiting}</td>
                  <td style={{ padding: "10px 8px" }}>{p.completed}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {p.notWorkingToday ? (
                      <Pill tone="#999">Not scheduled today</Pill>
                    ) : p.fullyBooked ? (
                      <Pill tone="#a12a2a">Fully booked</Pill>
                    ) : (
                      <span style={{ color: "#1a7f37", fontWeight: 700 }}>{p.nextAvailable}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upcoming Schedule */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>
          {isDoctor ? "My Schedule" : "Upcoming Schedule"}
        </h2>
        {data.upcoming.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
            {isDoctor ? "Nothing left on your schedule for today." : "Nothing left on the schedule for today."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {data.upcoming.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 700, color: "var(--text-heading)" }}>{a.time}</span>{" "}
                  <span style={{ color: "#333" }}>{a.patientName}</span>
                  {!isDoctor && a.providerName && <span style={{ color: "#999" }}> · {a.providerName}</span>}
                  {a.typeName && <span style={{ color: "#999" }}> · {a.typeName}</span>}
                </div>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: statusColor(undefined, a.status) }}>
                  {STATUS_GLYPH[a.status] ?? ""} {STATUS_LABEL[a.status] ?? a.status}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href={`/dashboard/calendar?view=day&date=${data.today}`} style={{ fontSize: 12.5, color: "#2563eb" }}>
          View full calendar →
        </Link>
      </div>
    </div>
  );
}
