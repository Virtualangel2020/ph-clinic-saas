"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LoadingButton } from "@/components/loading/loading-button";
import { DOB_MIN_DATE, dobMaxDate } from "@/lib/dob";

type Match = {
  mycaredesk_account_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  masked_email: string | null;
  masked_mobile: string | null;
  patient_number_last4: string | null;
};

// Spec (chart-integration doc, "patient-provider relationship" section):
// before creating a new patient record by hand, search whether this person
// already holds a MyCareDesk account (possibly registered at another
// clinic) by name + DOB, and send an access request instead of creating a
// second, disconnected identity for the same human. Sits above the
// existing Add Patient form as an optional first step — staff can ignore
// it and fill in the form as before if there's no match, so nothing about
// the existing "Add Patient" workflow is required to change.
export function MyCareDeskDedupSearch() {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    setSearched(false);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("staff_search_mycaredesk_accounts", { p_name: name, p_date_of_birth: dob });
    setSearching(false);
    setSearched(true);
    if (error) {
      setError(error.message);
      return;
    }
    setMatches((data as Match[]) ?? []);
  }

  async function requestAccess(accountId: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("staff_request_mycaredesk_access", {
      p_mycaredesk_account_id: accountId,
      p_message: "We'd like to link your existing MyCareDesk account to a patient record at our clinic.",
    });
    if (!error) {
      setRequestedIds((prev) => new Set(prev).add(accountId));
    } else {
      setError(error.message);
    }
  }

  return (
    <div style={{ background: "#f7f9fb", border: "1px solid #dde6ee", borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", fontWeight: 700, fontSize: 13.5, color: "var(--brand-primary)" }}
      >
        <span>Check if this patient already has a MyCareDesk account first</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 10 }}>
            Search by name and date of birth. If they already have an account (maybe from another clinic), send a request instead of creating a duplicate — they'll approve it from their MyCareDesk account.
          </p>
          <form onSubmit={search} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: "1 1 180px", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }} />
            <input required type="date" min={DOB_MIN_DATE} max={dobMaxDate()} value={dob} onChange={(e) => setDob(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13 }} />
            <LoadingButton type="submit" loading={searching} loadingText="Searching..." style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 600, fontSize: 13 }}>
              Search
            </LoadingButton>
          </form>

          {error && <p style={{ color: "crimson", fontSize: 12.5, marginTop: 8 }}>{error}</p>}

          {searched && !error && (
            <div style={{ marginTop: 12 }}>
              {matches.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "#888" }}>No matching MyCareDesk account found — go ahead and add them below as a new patient.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {matches.map((m) => (
                    <div key={m.mycaredesk_account_id} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {m.first_name} {m.last_name}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#888" }}>
                          DOB {new Date(m.date_of_birth).toLocaleDateString()} · {m.masked_email ?? m.masked_mobile ?? "no contact on file"}
                          {m.patient_number_last4 ? ` · MyCareDesk ID ending •${m.patient_number_last4}` : ""}
                        </div>
                      </div>
                      {requestedIds.has(m.mycaredesk_account_id) ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1a7f37" }}>Request sent ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => requestAccess(m.mycaredesk_account_id)}
                          style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-primary)", background: "white", border: "1px solid var(--brand-primary)", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
                        >
                          Send Access Request
                        </button>
                      )}
                    </div>
                  ))}
                  <p style={{ fontSize: 11.5, color: "#999", margin: 0 }}>
                    Not a match, or none approved yet? You can still add them as a new patient below — link them later once they approve.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
