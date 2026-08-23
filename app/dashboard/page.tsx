import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandHeader } from "@/components/brand-header";
import { addDays, formatTime, phDayStart, todayPh } from "./calendar/date-utils";
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

// Protected page. Deliberately queries user_profiles and tenants with
// the LOGGED-IN USER'S OWN session (no service-role key anywhere in
// this app) — if tenant isolation is working, this user can only ever
// see their own profile and their own tenant, never another clinic's.
//
// This is a real customer-facing page now (not just an RLS smoke test —
// that's what it started as), so it deliberately shows NOTHING raw:
// no JSON dumps, no internal status/source fields. Every state has a
// plain-language explanation and a clear next action.
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
    .select("full_name, role, tenant_id, tenants(name, status)")
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
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 28, textAlign: "center" }}>
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

  const { data: entitlements } = await supabase
    .from("tenant_entitlements")
    .select("feature_key, features(label)")
    .eq("status", "active")
    .order("feature_key");

  // Today's schedule — Calendar & Scheduling shipped a while back now, this
  // was left showing its old "isn't wired up yet" placeholder. Doctors see
  // just their own day; everyone else (reception, clinic admin) sees the
  // whole clinic's day, same as opening Calendar in day view would show.
  const today = todayPh();
  let todaysApptQuery = supabase
    .from("appointments")
    .select("id, start_at, end_at, status, patients(first_name,last_name), user_profiles(full_name), appointment_types(name,color)")
    .eq("tenant_id", profile.tenant_id)
    .gte("start_at", phDayStart(today))
    .lt("start_at", phDayStart(addDays(today, 1)))
    .order("start_at");
  if (profile.role === "doctor") {
    todaysApptQuery = todaysApptQuery.eq("provider_id", user!.id);
  }
  const { data: todaysAppointmentsRaw } = await todaysApptQuery;
  const todaysAppointments = (todaysAppointmentsRaw as any[]) ?? [];
  const APPT_PREVIEW_LIMIT = 6;

  // Rendered inside the EMR shell (app/dashboard/layout.tsx) once a tenant
  // exists — no BrandHeader/nav here, the shell already provides it.
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
      <p style={{ color: "#555", marginBottom: 20, fontSize: 13 }}>{tenant?.name ?? "Your clinic"} · {user!.email}</p>

      {tenant?.status && tenant.status !== "active" && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#7a5c12", marginBottom: 20 }}>
          Your clinic's status is currently <strong>{tenant.status.replace(/_/g, " ")}</strong>. Contact support if this looks wrong.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Today's schedule
          </h2>
          {todaysAppointments.length === 0 ? (
            <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
              {profile.role === "doctor" ? "No appointments on your schedule for today." : "No appointments scheduled for today."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {todaysAppointments.slice(0, APPT_PREVIEW_LIMIT).map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 700, color: "#0c1730" }}>{formatTime(a.start_at)}</span>{" "}
                    <span style={{ color: "#333" }}>{a.patients ? `${a.patients.last_name}, ${a.patients.first_name}` : "Unknown patient"}</span>
                    {profile.role !== "doctor" && a.user_profiles?.full_name && <span style={{ color: "#999" }}> · {a.user_profiles.full_name}</span>}
                    {a.appointment_types?.name && <span style={{ color: "#999" }}> · {a.appointment_types.name}</span>}
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: statusColor(undefined, a.status) }}>
                    {STATUS_GLYPH[a.status] ?? ""} {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
              ))}
              {todaysAppointments.length > APPT_PREVIEW_LIMIT && (
                <p style={{ color: "#999", fontSize: 12, margin: 0 }}>+{todaysAppointments.length - APPT_PREVIEW_LIMIT} more</p>
              )}
            </div>
          )}
          <Link href={`/dashboard/calendar?view=day&date=${today}`} style={{ fontSize: 12.5, color: "#2563eb" }}>
            View full calendar →
          </Link>
        </div>
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Quick links
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/dashboard/billing" style={{ fontSize: 13, color: "#2563eb" }}>Billing & invoices →</Link>
            <Link href="/dashboard/settings/clinic-profile" style={{ fontSize: 13, color: "#2563eb" }}>Clinic profile & branding →</Link>
            <Link href="/dashboard/settings/users" style={{ fontSize: 13, color: "#2563eb" }}>Staff & permissions →</Link>
          </div>
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>What's included in your system</h2>
        {entitlements && entitlements.length > 0 ? (
          <ul style={{ fontSize: 14, color: "#333", paddingLeft: 18, margin: 0, columns: 2 }}>
            {entitlements.map((e: any) => (
              <li key={e.feature_key} style={{ marginBottom: 4 }}>{e.features?.label ?? e.feature_key}</li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>Nothing active yet — this updates automatically once your plan is confirmed.</p>
        )}
        <p style={{ fontSize: 12, color: "#999", marginTop: 14, marginBottom: 0 }}>
          Want more? You can add features or upgrade your plan anytime as your clinic grows.
        </p>
      </div>
    </div>
  );
}
