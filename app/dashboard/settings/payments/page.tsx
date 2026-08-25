import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { paymongoMode } from "@/lib/patient-paymongo";
import { PaymentsToggle } from "./payments-toggle";
import { DemoResetSection } from "./demo-reset-section";

// Settings → Payments (§17). Online Payments ON/OFF is per-tenant
// (clinic_settings.accept_online_payments); PayMongo itself is currently
// AngelClinic's own single merchant account (process.env.PAYMONGO_*),
// shared across every clinic for now — see lib/patient-paymongo.ts for
// why, and what the plan is for a clinic to eventually get its own
// merchant account. Nothing here ever shows or accepts a secret key —
// there's nothing tenant-specific to configure on that front today.
export default async function PaymentsSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const { data: clinicSettings } = await supabase.from("clinic_settings").select("accept_online_payments").eq("tenant_id", profile.tenant_id).maybeSingle();
  const { data: tenant } = await supabase.from("tenants").select("is_test").eq("id", profile.tenant_id).maybeSingle();

  const mode = paymongoMode(); // "not_configured" | "test" | "live" — reads process.env server-side only
  const acceptOnline = clinicSettings?.accept_online_payments ?? false;

  let statusLabel: string;
  let statusColor: { bg: string; border: string; fg: string };
  if (mode === "not_configured") {
    statusLabel = "Not Configured";
    statusColor = { bg: "#f2f2f2", border: "#ddd", fg: "#666" };
  } else if (!acceptOnline) {
    statusLabel = mode === "test" ? "PayMongo — Test Mode (off)" : "PayMongo — Live (off)";
    statusColor = { bg: "#f2f2f2", border: "#ddd", fg: "#666" };
  } else if (mode === "test") {
    statusLabel = "PayMongo — Test Mode";
    statusColor = { bg: "#fff7e6", border: "#e6c66b", fg: "#7a5c12" };
  } else {
    statusLabel = "PayMongo — Live";
    statusColor = { bg: "#eaf7ee", border: "#bfe6c9", fg: "#1a7f37" };
  }

  let demoPatient: { id: string; charges: { id: string; description: string; amount_php: number; status: string }[] } | null = null;
  if (tenant?.is_test) {
    const { data: patient } = await supabase.from("patients").select("id").eq("tenant_id", profile.tenant_id).eq("first_name", "Angel").eq("last_name", "Testpatient").maybeSingle();
    if (patient) {
      const { data: charges } = await supabase.from("patient_charges").select("id, description, amount_php, status").eq("patient_id", patient.id).neq("status", "void");
      demoPatient = { id: patient.id, charges: ((charges as any[]) ?? []).map((c) => ({ ...c, amount_php: Number(c.amount_php) })) };
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Payments</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Let patients pay their invoices online through PayMongo (GCash, Maya, card, GrabPay), in addition to the
        manual cash/HMO/PhilHealth entries your Billing tab already supports.
      </p>

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>Online Payments</div>
            <div style={{ fontSize: 13.5, color: "#666", marginTop: 2 }}>Accept Online Payments</div>
          </div>
          <PaymentsToggle enabled={acceptOnline} disabled={mode === "not_configured"} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, background: statusColor.bg, border: `1px solid ${statusColor.border}`, color: statusColor.fg, borderRadius: 999, padding: "4px 12px" }}>
            {statusLabel}
          </span>
        </div>

        {mode === "not_configured" && (
          <p style={{ fontSize: 12.5, color: "#888", marginTop: 12, marginBottom: 0 }}>
            PayMongo isn&apos;t connected yet. This is configured once by Virtual Angel Systems (Vercel environment
            variables), not per clinic — reach out via Settings → Customer Care if you&apos;d like online payments
            enabled.
          </p>
        )}
        {mode === "test" && (
          <p style={{ fontSize: 12.5, color: "#8a6100", marginTop: 12, marginBottom: 0 }}>
            Test Mode — no real money moves. Card/GCash/Maya payments made here use PayMongo&apos;s test environment
            only.
          </p>
        )}
        {mode === "live" && acceptOnline && (
          <p style={{ fontSize: 12.5, color: "#1a7f37", marginTop: 12, marginBottom: 0 }}>
            Live — real payments will be charged. Turn this off if you need to pause online payments temporarily.
          </p>
        )}
      </div>

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0, marginBottom: 8 }}>How it works</h2>
        <p style={{ fontSize: 12.5, color: "#666", lineHeight: 1.7, margin: 0 }}>
          Once turned on, every open charge in a patient&apos;s Billing tab gets a <strong>Pay Online</strong> button
          for staff to send/show the patient, and the patient sees a matching <strong>Pay Now</strong> button under My
          Billing in their Patient Portal. Either one opens a secure PayMongo checkout page — nothing about the card
          or account used is ever stored here. Once PayMongo confirms the payment, it&apos;s recorded automatically
          and shows up in the patient&apos;s Billing tab, their Portal, and your Financial dashboard — all from the
          same transaction.
        </p>
      </div>

      {demoPatient && <DemoResetSection patientId={demoPatient.id} charges={demoPatient.charges} />}
    </div>
  );
}
