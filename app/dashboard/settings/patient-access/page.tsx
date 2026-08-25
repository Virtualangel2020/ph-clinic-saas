import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";

const BOOKING_TYPE_LABEL: Record<string, string> = {
  walk_in: "Walk-In Only",
  appointment: "Appointment Only",
  both: "Walk-In + Appointment",
  appointment_request: "Appointment Request",
  flexible: "Flexible / Variable Schedule",
};

// Settings → Patient Access & Payments hub (spec §1-2). Six cards, not one
// giant page — Availability and Appointment Instructions live inside
// Booking (they're the same "how/when a patient reaches this provider"
// decision), Payments reuses the existing Settings → Payments page as-is.
// Each card shows a quick status summary so a clinic admin can tell what's
// configured without opening it.
export default async function PatientAccessHubPage() {
  const { supabase, profile } = await requireClinicMember();
  const tenantId = profile.tenant_id;

  const [{ data: clinicSettings }, { count: providerOverrideCount }, { count: serviceCount }, { count: priceableCount }, { count: hmoCount }, { count: activeProviderCount }] = await Promise.all([
    supabase
      .from("clinic_settings")
      .select(
        "default_booking_type, accept_hmo, accept_yakap, default_messaging_enabled, cancellation_policy, patient_access_setup_completed, accept_online_payments"
      )
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase.from("provider_patient_access_settings").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("appointment_types").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("appointment_types").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("show_price_to_patient", true),
    supabase.from("clinic_accepted_hmos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("role", "doctor").eq("is_active", true),
  ]);

  const cs = clinicSettings as any;
  const policy = cs?.cancellation_policy ?? {};
  const hasNoShowFee = policy?.noShowFee?.afterCount && policy.noShowFee.afterCount !== "never";
  const hasAdvancePayment = policy?.prepaidNoShow?.mode && policy.prepaidNoShow.mode !== "keep_0";

  const cards = [
    {
      href: "/dashboard/settings/patient-access/booking",
      title: "Booking, Availability & Instructions",
      desc: "How patients reach each provider, cutoffs, arrival reminders, and custom instructions.",
      status: `${BOOKING_TYPE_LABEL[cs?.default_booking_type] ?? "Not set"} · ${providerOverrideCount ?? 0}/${activeProviderCount ?? 0} providers customized`,
    },
    {
      href: "/dashboard/settings/patient-access/services",
      title: "Services & Fees",
      desc: "Pricing, price visibility, and advance-payment rules per appointment type.",
      status: `${serviceCount ?? 0} service${(serviceCount ?? 0) === 1 ? "" : "s"} · ${priceableCount ?? 0} showing a price to patients`,
    },
    {
      href: "/dashboard/settings/payments",
      title: "Payments",
      desc: "Accept Online Payments (PayMongo) — the on/off switch patients see reflected everywhere.",
      status: cs?.accept_online_payments ? "Online payments ON" : "Online payments OFF",
    },
    {
      href: "/dashboard/settings/patient-access/coverage",
      title: "HMO / YAKAP / Coverage",
      desc: "Which HMOs your clinic accepts, verification requirements, and YAKAP participation.",
      status: `HMO ${cs?.accept_hmo ? "ON" : "OFF"} (${hmoCount ?? 0} listed) · YAKAP ${cs?.accept_yakap ? "ON" : "OFF"}`,
    },
    {
      href: "/dashboard/settings/patient-access/messaging",
      title: "Patient Messaging",
      desc: "Who can message each provider, and when — off by default until a provider turns it on.",
      status: `Clinic default: Messaging ${cs?.default_messaging_enabled ? "ON" : "OFF"}`,
    },
    {
      href: "/dashboard/settings/patient-access/cancellation",
      title: "Cancellation & No-Show Policy",
      desc: "Refund rules, no-show fees, and the policy patients acknowledge before paying online.",
      status: hasNoShowFee || hasAdvancePayment ? "Fees/retention configured" : "Simple — no fees configured",
    },
  ];

  return (
    <div style={{ maxWidth: 880 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Patient Access & Payments</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
        How your clinic accepts patients, what it charges, how it gets paid, and how patients reach each provider —
        AngelClinic adapts to how each provider actually operates, not the other way around. Set clinic-wide
        defaults once; only customize a specific provider when they genuinely work differently.
      </p>
      {!cs?.patient_access_setup_completed && (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "#7a5c12", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span>
            Setup isn&apos;t marked complete yet. Every setting below already has a safe default (nothing patient-facing
            turns on by itself) — walk through each card whenever you&apos;re ready, or use the guided setup.
          </span>
          <Link href="/dashboard/settings/patient-access/setup" style={{ fontSize: 12, fontWeight: 700, color: "#7a5c12", background: "white", border: "1px solid #e6c66b", borderRadius: 8, padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>
            Start Guided Setup →
          </Link>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{ display: "block", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 16, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-heading)", marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>{c.desc}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4a6fa5" }}>{c.status}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
