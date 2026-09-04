import type { SupabaseClient } from "@supabase/supabase-js";
import { todayPh, phDayStart, startOfMonth } from "@/app/dashboard/calendar/date-utils";
import { getEmailProviderStatus, getSmsProviderStatus } from "@/lib/patient-portal/send";

// Data loader for /dashboard/communications — the rebuild of what used to
// be a static "Phase 7" placeholder. Email + SMS are genuinely wired to
// send (see lib/patient-portal/send.ts, the same functions Patient Portal
// invites already use) once a Superadmin turns on Resend/Semaphore with a
// real API key in Admin → Settings; until then this page says so plainly
// rather than pretending. WhatsApp and Telephone Encounters have no
// backing integration/data model yet, so they're surfaced as their own
// honest "not connected yet" state — not built here.

export type CommunicationRow = {
  id: string;
  patientId: string;
  patientName: string;
  channel: "email" | "sms";
  toAddress: string;
  subject: string | null;
  message: string;
  status: "sent" | "failed";
  error: string | null;
  createdAt: string;
};

export type CommunicationsData = {
  email: { provider: string; configured: boolean };
  sms: { provider: string; configured: boolean };
  sentToday: number;
  sentThisMonth: number;
  failedRecentCount: number;
  recent: CommunicationRow[];
};

export async function getCommunicationsData(supabase: SupabaseClient, tenantId: string): Promise<CommunicationsData> {
  const today = todayPh();
  const todayStart = phDayStart(today);
  const monthStart = phDayStart(startOfMonth(today));

  const [email, sms, { data: rows }] = await Promise.all([
    getEmailProviderStatus(),
    getSmsProviderStatus(),
    supabase
      .from("patient_communications")
      .select("id, patient_id, channel, to_address, subject, message, status, error, created_at, patients(first_name,last_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const recent: CommunicationRow[] = ((rows as any[]) ?? []).map((r) => ({
    id: r.id as string,
    patientId: r.patient_id as string,
    patientName: r.patients ? `${r.patients.last_name}, ${r.patients.first_name}` : "Unknown patient",
    channel: r.channel as "email" | "sms",
    toAddress: r.to_address as string,
    subject: r.subject as string | null,
    message: r.message as string,
    status: r.status as "sent" | "failed",
    error: r.error as string | null,
    createdAt: r.created_at as string,
  }));

  const sentToday = recent.filter((r) => r.status === "sent" && r.createdAt >= todayStart).length;
  const sentThisMonth = recent.filter((r) => r.status === "sent" && r.createdAt >= monthStart).length;
  const failedRecentCount = recent.filter((r) => r.status === "failed").length;

  return {
    email,
    sms,
    sentToday,
    sentThisMonth,
    failedRecentCount,
    recent: recent.slice(0, 20),
  };
}
