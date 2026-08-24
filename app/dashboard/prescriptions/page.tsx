import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { RecordRefillButton } from "./record-refill-button";

type PrescriptionItem = { id: string; drug_name: string; dosage: string | null; form: string | null };

type PrescriptionRow = {
  id: string;
  status: string;
  prescribed_at: string;
  renewal_type: string;
  refill_count: number | null;
  refill_due_at: string | null;
  reminder_days_before: number | null;
  patients: { id: string; first_name: string; last_name: string } | null;
  user_profiles: { full_name: string | null } | null;
  prescription_items: PrescriptionItem[];
};

function drugSummary(items: PrescriptionItem[]) {
  if (!items || items.length === 0) return "No items";
  const names = items.map((i) => i.drug_name).filter(Boolean);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

function daysUntil(dateStr: string) {
  const ms = new Date(dateStr).getTime() - new Date(new Date().toDateString()).getTime();
  return Math.round(ms / 86400000);
}

// Refills (spec §25) — the global "Prescriptions" nav entry, renamed and
// repurposed. Rather than a flat list of every prescription ever written
// (that view still lives in each patient's own chart), this is a due-soon
// / due-today / overdue QUEUE over the same `prescriptions` rows, filtered
// to renewal_type = 'renewable' and status = 'active'. One-time
// prescriptions never show up here — nothing to renew.
export default async function RefillsPage({ searchParams }: { searchParams: { bucket?: string } }) {
  const { supabase, profile } = await requireClinicMember();
  const bucketFilter = searchParams.bucket || "";

  const { data: prescriptions } = await supabase
    .from("prescriptions")
    .select(
      "id, status, prescribed_at, renewal_type, refill_count, refill_due_at, reminder_days_before, patients(id, first_name, last_name), user_profiles(full_name), prescription_items(id, drug_name, dosage, form)"
    )
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "active")
    .eq("renewal_type", "renewable")
    .not("refill_due_at", "is", null)
    .order("refill_due_at", { ascending: true });

  const rows = (prescriptions as unknown as PrescriptionRow[]) ?? [];

  const buckets = { overdue: [] as PrescriptionRow[], due_today: [] as PrescriptionRow[], due_soon: [] as PrescriptionRow[], upcoming: [] as PrescriptionRow[] };
  for (const p of rows) {
    const d = daysUntil(p.refill_due_at!);
    const window = p.reminder_days_before ?? 7;
    if (d < 0) buckets.overdue.push(p);
    else if (d === 0) buckets.due_today.push(p);
    else if (d <= window) buckets.due_soon.push(p);
    else buckets.upcoming.push(p);
  }

  const BUCKET_META: { key: keyof typeof buckets; label: string; color: string; bg: string; border: string }[] = [
    { key: "overdue", label: "Overdue", color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9" },
    { key: "due_today", label: "Due Today", color: "#a12a2a", bg: "#fbeaea", border: "#f0c9c9" },
    { key: "due_soon", label: "Due Soon", color: "#8a6100", bg: "#fff6e6", border: "#f0d998" },
    { key: "upcoming", label: "Upcoming", color: "#666", bg: "#f2f2f2", border: "#ddd" },
  ];

  const visibleBuckets = bucketFilter ? BUCKET_META.filter((b) => b.key === bucketFilter) : BUCKET_META;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Refills</h1>
      <p style={{ color: "#666", marginBottom: 12, fontSize: 13 }}>
        Renewable prescriptions across your patients, due soon or overdue. One-time prescriptions and each patient's
        full prescription history still live in their own chart's Prescriptions tab.
      </p>

      <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: "#7a5c12", marginBottom: 18 }}>
        <strong>Electronic Pharmacy Network — Coming Soon.</strong> Refills recorded here update the patient's own
        record, but AngelClinic doesn't yet send prescriptions electronically to a pharmacy. For now, please issue a
        printed or photographed copy when a refill is due.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {BUCKET_META.map((b) => (
          <Link
            key={b.key}
            href={bucketFilter === b.key ? "/dashboard/prescriptions" : `/dashboard/prescriptions?bucket=${b.key}`}
            style={{
              background: bucketFilter === b.key ? b.color : "var(--card-bg)",
              border: `1px solid ${bucketFilter === b.key ? b.color : "var(--card-border)"}`,
              borderRadius: 10,
              padding: "10px 16px",
              textDecoration: "none",
              minWidth: 90,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: bucketFilter === b.key ? "white" : b.color }}>{buckets[b.key].length}</div>
            <div style={{ fontSize: 11, color: bucketFilter === b.key ? "#fff" : "#888" }}>{b.label}</div>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          No renewable prescriptions on file yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {visibleBuckets.map((b) =>
            buckets[b.key].length === 0 ? null : (
              <div key={b.key}>
                <h2 style={{ fontSize: 13.5, color: b.color, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>{b.label}</h2>
                <div style={{ display: "grid", gap: 8 }}>
                  {buckets[b.key].map((p) => (
                    <div
                      key={p.id}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: `1px solid ${b.border}`, borderRadius: 10, padding: "12px 16px", gap: 12 }}
                    >
                      <Link href={`/dashboard/patients/${p.patients?.id ?? ""}?tab=prescriptions`} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>
                          {p.patients ? `${p.patients.last_name}, ${p.patients.first_name}` : "Unknown patient"}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#333", marginTop: 2 }}>{drugSummary(p.prescription_items)}</div>
                        <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                          {p.user_profiles?.full_name ?? "Unknown prescriber"} · Due {new Date(p.refill_due_at!).toLocaleDateString()}
                          {p.refill_count !== null ? ` · ${p.refill_count} refill(s) left` : ""}
                        </div>
                      </Link>
                      <RecordRefillButton id={p.id} patientId={p.patients?.id ?? ""} />
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
