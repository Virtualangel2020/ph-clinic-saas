"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchPatientsAction, type PatientSearchResult } from "@/app/dashboard/patients/actions";

function age(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchPatientsAction(query)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  function go(id: string) {
    setOpen(false);
    setQ("");
    router.push(`/dashboard/patients/${id}`);
  }

  function submitFullSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    if (results.length === 1) return go(results[0].id);
    setOpen(false);
    router.push(`/dashboard/patients?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div ref={boxRef} style={{ position: "relative", flex: 1, maxWidth: 420 }}>
      <form onSubmit={submitFullSearch}>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search patients by name or phone…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 13,
            background: "white",
            color: "#333",
          }}
        />
      </form>

      {open && q.trim() && (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {loading ? (
            <div style={{ padding: "10px 14px", fontSize: 12.5, color: "#999" }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: "10px 14px", fontSize: 12.5, color: "#999" }}>No patients match "{q}".</div>
          ) : (
            <>
              {results.map((p) => (
                <div
                  key={p.id}
                  onClick={() => go(p.id)}
                  style={{ padding: "9px 14px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f2f2f2", opacity: p.is_active ? 1 : 0.55 }}
                >
                  <div style={{ fontWeight: 700, color: "#0c1730" }}>
                    {p.last_name}, {p.first_name} {p.middle_name ? p.middle_name.charAt(0) + "." : ""}
                    {!p.is_active && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#a12a2a", fontWeight: 700 }}>ARCHIVED</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#888" }}>
                    {age(p.date_of_birth)} y/o {p.mobile_phone ? `· ${p.mobile_phone}` : ""}
                  </div>
                </div>
              ))}
              <div
                onClick={() => {
                  setOpen(false);
                  router.push(`/dashboard/patients?q=${encodeURIComponent(q.trim())}`);
                }}
                style={{ padding: "9px 14px", fontSize: 12, color: "#0c1730", fontWeight: 600, cursor: "pointer" }}
              >
                See all results in Patients →
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
