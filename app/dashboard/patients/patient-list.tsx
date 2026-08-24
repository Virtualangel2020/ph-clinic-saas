"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Patient = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  sex: string;
  mobile_phone: string | null;
  is_active: boolean;
};

function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export function PatientList({ patients, initialQuery }: { patients: Patient[]; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery ?? "");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return patients
      .filter((p) => (showArchived ? true : p.is_active))
      .filter((p) => {
        if (!query) return true;
        const full = `${p.first_name} ${p.middle_name ?? ""} ${p.last_name}`.toLowerCase();
        return full.includes(query);
      });
  }, [patients, q, showArchived]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          style={{ flex: 1, minWidth: 220, border: "1px solid var(--input-border)", borderRadius: 8, padding: "9px 12px", fontSize: 13.5 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#666" }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>
          {patients.length === 0 ? "No patients yet — add your first one." : "No patients match your search."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/patients/${p.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: 10,
                padding: "13px 16px",
                textDecoration: "none",
                opacity: p.is_active ? 1 : 0.55,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-heading)" }}>
                  {p.last_name}, {p.first_name} {p.middle_name ? p.middle_name.charAt(0) + "." : ""}
                  {!p.is_active && <span style={{ marginLeft: 8, fontSize: 11, color: "#a12a2a", fontWeight: 600 }}>ARCHIVED</span>}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {age(p.date_of_birth)} y/o · {p.sex} {p.mobile_phone ? `· ${p.mobile_phone}` : ""}
                </div>
              </div>
              <div style={{ color: "#bbb", fontSize: 18 }}>›</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
