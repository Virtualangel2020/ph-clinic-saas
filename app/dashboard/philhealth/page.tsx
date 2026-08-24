import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";

// Clinic-wide view of every active patient's PhilHealth number/member
// type (see /dashboard/patients/[id]'s Coverage tab where it actually gets
// set, via coverage-section.tsx). philhealth_number/member_type are plain
// columns on patients, not a separate table — this page only reads;
// writes go through ./actions.ts.
export default async function PhilhealthPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { supabase, profile } = await requireClinicMember();
  const { filter } = await searchParams;
  const missingOnly = filter === "missing";

  let query = supabase
    .from("patients")
    .select("id, first_name, last_name, philhealth_number, philhealth_member_type")
    .eq("tenant_id", profile.tenant_id)
    .eq("is_active", true);

  if (missingOnly) query = query.is("philhealth_number", null);

  const { data: patientsRaw } = await query.order("last_name");
  const patients = (patientsRaw as any[]) ?? [];

  const totalActive = missingOnly ? undefined : patients.length;
  const missingCount = patients.filter((p) => !p.philhealth_number).length;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>PhilHealth</h1>
      <p style={{ color: "#666", marginBottom: 12, fontSize: 13 }}>
        PhilHealth membership on file for every active patient. Update it from a patient's own chart.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-heading)" }}>
          {missingOnly ? `${patients.length} patient${patients.length === 1 ? "" : "s"} missing a PhilHealth #` : `${totalActive} active patient${totalActive === 1 ? "" : "s"} · ${missingCount} missing a PhilHealth #`}
        </div>
        <Link
          href={missingOnly ? "/dashboard/philhealth" : "/dashboard/philhealth?filter=missing"}
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            textDecoration: "none",
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${missingOnly ? "#0c1730" : "#ddd"}`,
            background: missingOnly ? "#0c1730" : "white",
            color: missingOnly ? "white" : "#555",
          }}
        >
          {missingOnly ? "Showing missing only — show all" : "Show missing only"}
        </Link>
      </div>

      {patients.length === 0 ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          {missingOnly ? "Every active patient has a PhilHealth # on file." : "No active patients yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {patients.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/patients/${p.id}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "12px 16px", textDecoration: "none", gap: 12, flexWrap: "wrap" }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>
                {p.last_name}, {p.first_name}
              </div>
              {p.philhealth_number ? (
                <div style={{ fontSize: 12, color: "#666" }}>
                  {p.philhealth_number}
                  {p.philhealth_member_type ? ` · ${p.philhealth_member_type}` : ""}
                </div>
              ) : (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a12a2a", background: "#fbebeb", border: "1px solid #eec7c7", borderRadius: 999, padding: "2px 8px" }}>
                  Missing PhilHealth #
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
