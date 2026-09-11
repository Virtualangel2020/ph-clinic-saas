import Link from "next/link";
import { requirePatientPortal } from "@/lib/require-patient-portal";
import { PortalShell } from "@/components/portal-shell";
import { getPortalBalanceSummary, pesoLabel } from "@/lib/patients/portal-balance";
import { appointmentWording } from "@/lib/patients/appointment-wording";
import { getLastCompletedEncounter } from "@/lib/patients/last-visit";
import { STATUS_LABEL as APPT_STATUS_LABEL } from "@/app/dashboard/calendar/status-constants";
import { DismissStatusEventButton } from "./dismiss-status-event-button";

const RECENCY_WINDOW_DAYS = 14;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });
}

// Patient Dashboard (spec Parts 12-39, "Consolidated Update") — replaces
// the old My-Info/Next-Appointment/Balance home page. Built entirely
// around "what do I need to know or do right now," in priority order:
// Needs Attention -> Coming Up -> New For You -> Recent Care -> Financial.
// Every section is conditionally rendered — a patient with nothing
// outstanding sees a short, calm page, not empty cards. Nothing here is
// dashboard-only math: every number comes from the exact same rows the
// clinic's own staff views and the portal's other pages already read,
// via the existing portal-self-read RLS policies (is_portal_patient()).
export default async function PortalHomePage() {
  const { supabase, account } = await requirePatientPortal();
  const cutoffIso = new Date(Date.now() - RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Identity-level data — resolved from the platform mycaredesk_accounts
  // identity, so it's available whether or not this patient has connected
  // with a clinic yet (bug fix: a brand-new self-registered patient used
  // to get bounced out of the whole portal because everything below this
  // point required a clinic relationship that doesn't exist yet — see
  // requirePatientPortal). Access requests in particular matter MORE for
  // a 0-clinic patient: that's literally how a clinic connects with them.
  const [{ data: mycaredeskAccount }, { data: accessRequestsRaw }] = await Promise.all([
    supabase.rpc("get_my_mycaredesk_account"),
    supabase.rpc("patient_list_my_access_requests"),
  ]);

  let healthProfileNudge: { title: string; subtitle: string } | null = null;
  if (!mycaredeskAccount) {
    healthProfileNudge = { title: "Set up your Health Profile", subtitle: "One quick step — share allergies, medications, and conditions with your doctors." };
  } else {
    const { data: profileRow } = await supabase.from("mycaredesk_health_profiles").select("mycaredesk_account_id").eq("mycaredesk_account_id", (mycaredeskAccount as any).id).maybeSingle();
    if (!profileRow) {
      healthProfileNudge = { title: "Complete your Health Profile", subtitle: "Share allergies, medications, and conditions with your doctors — nothing is required." };
    }
  }

  // No clinic relationship yet — a brand-new self-registered patient.
  // Every clinic-scoped section below (Coming Up, New For You, Recent
  // Care, Financial) has nothing to query, so skip straight to a short,
  // onboarding-flavored dashboard. The normal portal nav (PortalShell)
  // stays fully visible and functional the whole time — Appointments,
  // Billing, Messages etc. each show their own graceful empty state if
  // visited, they're never hidden or redirected away from.
  if (!account) {
    const attentionItems: { key: string; title: string; subtitle: string; action: React.ReactNode }[] = [];
    const pendingAccessRequest = ((accessRequestsRaw as any[]) ?? []).find((r) => r.status === "pending");
    if (pendingAccessRequest) {
      attentionItems.push({
        key: "access-request",
        title: "Clinic Requesting Access",
        subtitle: `${pendingAccessRequest.clinic_name} wants to link your MyCareDesk account to a patient record.`,
        action: (
          <Link href="/portal/health-profile" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-heading, var(--brand-primary))", textDecoration: "none", flexShrink: 0 }}>
            Review →
          </Link>
        ),
      });
    }

    return (
      <PortalShell>
        <h1 style={{ fontSize: 21, marginBottom: 4 }}>Welcome to MyCareDesk{(mycaredeskAccount as any)?.first_name ? `, ${(mycaredeskAccount as any).first_name}` : ""}!</h1>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Your account is ready. Fill in your Health Profile whenever you have a few minutes, or jump straight to finding a doctor.</p>

        <div style={{ display: "grid", gap: 14 }}>
          {attentionItems.length > 0 && (
            <section style={{ background: "white", border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: "#7a5c12", textTransform: "uppercase", letterSpacing: 0.4, margin: 0, padding: "14px 18px 10px", background: "#fffaf0" }}>
                Needs Attention
              </h2>
              <div>
                {attentionItems.map((item, i) => (
                  <div
                    key={item.key}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 18px", borderTop: i === 0 ? "1px solid #f5ead0" : "1px solid #f0f0f0" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{item.subtitle}</div>
                    </div>
                    {item.action}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>Get Started</h2>
            <p style={{ color: "#999", fontSize: 12.5, margin: "0 0 14px" }}>
              You're not connected with a clinic yet. Booking your first appointment — or a clinic approving your access
              request — connects your account automatically.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {healthProfileNudge && (
                <Link
                  href="/portal/health-profile"
                  style={{ display: "block", background: "var(--brand-primary)", color: "white", borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
                >
                  {healthProfileNudge.title} →
                </Link>
              )}
              <Link
                href="/portal/find-a-doctor"
                style={{ display: "block", background: "white", border: "1px solid #ddd", color: "var(--brand-primary)", borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
              >
                Find a Doctor →
              </Link>
            </div>
          </section>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {[
            { href: "/portal/care", label: "My Care" },
            { href: "/portal/messages", label: "Messages" },
            { href: "/portal/appointments", label: "Appointments" },
            { href: "/portal/profile", label: "Profile" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ display: "block", background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, fontWeight: 600, color: "#333", textDecoration: "none" }}
            >
              {l.label} →
            </Link>
          ))}
        </div>
      </PortalShell>
    );
  }

  const patientId = account.patient_id;
  const tenantId = account.tenant_id;

  const [
    { data: patient },
    { data: nextAppt },
    { data: assignedForms },
    { data: followUpsRaw },
    { data: statusEvents },
    { data: resultsRaw },
    { data: prescriptionsRaw },
    { data: documentsRaw },
    { data: threadsRaw },
    lastVisit,
    balance,
  ] = await Promise.all([
    supabase.from("patients").select("first_name, mycaredesk_account_id").eq("id", patientId).maybeSingle(),
    supabase
      .from("appointments")
      .select("id, start_at, end_at, booking_mode, expected_arrival_at, user_profiles(full_name, title), appointment_types(name)")
      .eq("patient_id", patientId)
      .gte("start_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("patient_forms").select("id, template_name").eq("patient_id", patientId).eq("status", "assigned"),
    supabase.rpc("patient_list_my_follow_ups"),
    supabase
      .from("appointment_status_events")
      .select("id, old_status, new_status, old_start_at, new_start_at, changed_at")
      .eq("patient_id", patientId)
      .is("acknowledged_at", null)
      .order("changed_at", { ascending: false }),
    supabase.from("lab_results").select("id, result_summary, released_at").eq("patient_id", patientId).eq("status", "released").gte("released_at", cutoffIso).order("released_at", { ascending: false }),
    supabase.from("prescriptions").select("id, prescribed_at").eq("patient_id", patientId).gte("prescribed_at", cutoffIso).order("prescribed_at", { ascending: false }),
    supabase.from("patient_documents").select("id, title, created_at").eq("patient_id", patientId).eq("status", "active").gte("created_at", cutoffIso).order("created_at", { ascending: false }),
    supabase.rpc("portal_list_message_threads"),
    getLastCompletedEncounter(supabase, patientId),
    getPortalBalanceSummary(supabase, patientId),
  ]);

  // Follow-ups needing action are the RPC's 'pending' rows only —
  // 'scheduled' ones already have a booked visit and show up naturally
  // under Coming Up / My Appointments instead. patient_list_my_follow_ups
  // returns raw patient_follow_ups columns (no embed support on RPC
  // results), so provider names are resolved with one small follow-up
  // query rather than joining in SQL.
  const pendingFollowUps = ((followUpsRaw as any[]) ?? []).filter((f) => f.status === "pending");
  const providerIds = [...new Set(pendingFollowUps.map((f) => f.provider_id).filter(Boolean))];
  const { data: followUpProviders } = providerIds.length > 0 ? await supabase.from("user_profiles").select("id, full_name, title").in("id", providerIds) : { data: [] as any[] };
  const providerById = new Map<string, any>((followUpProviders as any[])?.map((p) => [p.id, p]) ?? []);

  // Access requests are platform-level (keyed by mycaredesk_account_id,
  // resolved from auth.uid() by the RPC itself) — narrowed here to THIS
  // clinic's pending request, since a request from a different clinic has
  // no business showing on this tenant's dashboard.
  const pendingAccessRequest = ((accessRequestsRaw as any[]) ?? []).find((r) => r.status === "pending" && r.tenant_id === tenantId);

  const unreadThreads = ((threadsRaw as any[]) ?? []).filter((t) => t.unread_count > 0);
  const unreadTotal = unreadThreads.reduce((sum, t) => sum + t.unread_count, 0);

  // healthProfileNudge was already resolved above (identity-level, shared
  // with the 0-clinic branch) from the platform mycaredesk_accounts
  // identity rather than this clinic's patients.mycaredesk_account_id
  // link — more correct anyway, since it now works the same way
  // regardless of clinic relationship.

  type AttentionItem = { key: string; title: string; subtitle: string; action?: React.ReactNode };
  const attentionItems: AttentionItem[] = [];

  for (const ev of (statusEvents as any[]) ?? []) {
    const changedTime = ev.old_start_at !== ev.new_start_at;
    const changedStatus = ev.old_status !== ev.new_status;
    const label = ev.new_status === "cancelled" ? "Appointment Cancelled" : changedTime ? "Appointment Rescheduled" : changedStatus ? "Appointment Updated" : "Appointment Changed";
    const subtitleParts: string[] = [];
    if (changedTime) subtitleParts.push(`Now ${fmtDate(ev.new_start_at)}${ev.old_start_at ? ` (was ${fmtDate(ev.old_start_at)})` : ""}`);
    if (changedStatus && ev.new_status !== "cancelled") subtitleParts.push(APPT_STATUS_LABEL[ev.new_status] ?? ev.new_status);
    attentionItems.push({
      key: `status-event-${ev.id}`,
      title: label,
      subtitle: subtitleParts.join(" · ") || "Please check your appointment details.",
      action: <DismissStatusEventButton eventId={ev.id} />,
    });
  }

  for (const f of pendingFollowUps) {
    const overdue = f.due_date && f.due_date < todayStr;
    const provider = providerById.get(f.provider_id);
    const providerLabel = provider ? `${provider.title ? provider.title + " " : ""}${provider.full_name}` : "your provider";
    attentionItems.push({
      key: `follow-up-${f.id}`,
      title: "Follow-Up Needed",
      subtitle: `${f.reason ? f.reason + " · " : ""}${providerLabel}${f.due_date ? ` · ${overdue ? "Overdue since" : "Due"} ${fmtDate(f.due_date)}` : ""}`,
      action: (
        <Link
          href={`/portal/book/${f.provider_id}?followUpId=${f.id}`}
          style={{ fontSize: 11.5, fontWeight: 700, color: "white", background: "var(--brand-primary)", borderRadius: 6, padding: "5px 12px", textDecoration: "none", flexShrink: 0 }}
        >
          Schedule
        </Link>
      ),
    });
  }

  if (assignedForms && assignedForms.length > 0) {
    attentionItems.push({
      key: "forms",
      title: `${assignedForms.length} Form${assignedForms.length === 1 ? "" : "s"} Waiting`,
      subtitle: (assignedForms as any[]).map((f) => f.template_name).filter(Boolean).slice(0, 2).join(", ") || "Your clinic needs this filled out.",
      action: (
        <Link href="/portal/forms" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-heading, var(--brand-primary))", textDecoration: "none", flexShrink: 0 }}>
          Fill out →
        </Link>
      ),
    });
  }

  if (pendingAccessRequest) {
    attentionItems.push({
      key: "access-request",
      title: "Clinic Requesting Access",
      subtitle: `${pendingAccessRequest.clinic_name} wants to link your MyCareDesk account to a patient record.`,
      action: (
        <Link href="/portal/health-profile" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-heading, var(--brand-primary))", textDecoration: "none", flexShrink: 0 }}>
          Review →
        </Link>
      ),
    });
  }

  if (healthProfileNudge) {
    attentionItems.push({
      key: "health-profile",
      title: healthProfileNudge.title,
      subtitle: healthProfileNudge.subtitle,
      action: (
        <Link href="/portal/health-profile" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-heading, var(--brand-primary))", textDecoration: "none", flexShrink: 0 }}>
          Start →
        </Link>
      ),
    });
  }

  const newForYou: { key: string; label: string; href: string }[] = [];
  if ((resultsRaw as any[])?.length) newForYou.push({ key: "results", label: `${resultsRaw!.length} new result${resultsRaw!.length === 1 ? "" : "s"} available`, href: "/portal/results" });
  if ((prescriptionsRaw as any[])?.length)
    newForYou.push({ key: "prescriptions", label: `${prescriptionsRaw!.length} new prescription${prescriptionsRaw!.length === 1 ? "" : "s"}`, href: "/portal/prescriptions" });
  if ((documentsRaw as any[])?.length) newForYou.push({ key: "documents", label: `${documentsRaw!.length} new document${documentsRaw!.length === 1 ? "" : "s"} filed`, href: "/portal/records" });
  if (unreadTotal > 0)
    newForYou.push({
      key: "messages",
      label: unreadThreads.length === 1 ? `New message from ${unreadThreads[0].provider_name}` : `${unreadTotal} new messages`,
      href: "/portal/messages",
    });

  const nextApptWording = nextAppt ? appointmentWording(nextAppt as any) : null;

  return (
    <PortalShell>
      <h1 style={{ fontSize: 21, marginBottom: 4 }}>Welcome{patient ? `, ${patient.first_name}` : ""}</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Here's what needs your attention.</p>

      <div style={{ display: "grid", gap: 14 }}>
        {attentionItems.length > 0 && (
          <section style={{ background: "white", border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: "#7a5c12", textTransform: "uppercase", letterSpacing: 0.4, margin: 0, padding: "14px 18px 10px", background: "#fffaf0" }}>
              Needs Attention
            </h2>
            <div>
              {attentionItems.map((item, i) => (
                <div
                  key={item.key}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 18px", borderTop: i === 0 ? "1px solid #f5ead0" : "1px solid #f0f0f0" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{item.subtitle}</div>
                  </div>
                  {item.action}
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>Coming Up</h2>
          {nextAppt && nextApptWording ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
              <div>
                <strong>{nextApptWording.headline}</strong>
              </div>
              {nextApptWording.subline && <div style={{ color: "#888", fontSize: 11.5, fontStyle: "italic", marginTop: 1 }}>{nextApptWording.subline}</div>}
              <div style={{ color: "#666" }}>{(nextAppt as any).appointment_types?.name ?? "Consultation"}</div>
              <div style={{ color: "#666" }}>
                {(nextAppt as any).user_profiles ? `${(nextAppt as any).user_profiles.title ? (nextAppt as any).user_profiles.title + " " : ""}${(nextAppt as any).user_profiles.full_name}` : ""}
              </div>
            </div>
          ) : (
            <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>No upcoming appointments.</p>
          )}
          <Link href="/portal/appointments" style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: "var(--text-heading, var(--brand-primary))", fontWeight: 600, textDecoration: "none" }}>
            View all appointments →
          </Link>
        </section>

        {newForYou.length > 0 && (
          <section style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>New For You</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {newForYou.map((n) => (
                <Link
                  key={n.key}
                  href={n.href}
                  style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-heading, #222)", textDecoration: "none", background: "#f7f7f9", borderRadius: 8, padding: "10px 12px" }}
                >
                  {n.label} →
                </Link>
              ))}
            </div>
          </section>
        )}

        {lastVisit && (
          <section style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>Recent Care</h2>
            <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
              <div>
                <strong>{fmtDate(lastVisit.encounter_date)}</strong> — {lastVisit.encounter_type ?? "Visit"}
              </div>
              {lastVisit.chief_complaint && <div style={{ color: "#666" }}>{lastVisit.chief_complaint}</div>}
              {lastVisit.provider_name && <div style={{ color: "#666" }}>{lastVisit.provider_name}</div>}
            </div>
            <Link href="/portal/care" style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: "var(--text-heading, var(--brand-primary))", fontWeight: 600, textDecoration: "none" }}>
              View My Care →
            </Link>
          </section>
        )}

        {balance.balance > 0 && (
          <section style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 0, marginBottom: 10 }}>Financial</h2>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#a12a2a" }}>{pesoLabel(balance.balance)}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Balance due</div>
            <Link href="/portal/billing" style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: "var(--text-heading, var(--brand-primary))", fontWeight: 600, textDecoration: "none" }}>
              View billing & pay →
            </Link>
          </section>
        )}
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {[
          { href: "/portal/find-a-doctor", label: "Find a Doctor" },
          { href: "/portal/care", label: "My Care" },
          { href: "/portal/messages", label: "Messages" },
          { href: "/portal/appointments", label: "Appointments" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{ display: "block", background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, fontWeight: 600, color: "#333", textDecoration: "none" }}
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
