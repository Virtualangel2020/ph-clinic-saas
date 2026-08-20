"use client";

import { useMemo, useState } from "react";
import { AppointmentRequestForm } from "./appointment-request-form";

type Provider = {
  id: string;
  full_name: string;
  title: string | null;
  specialty: string | null;
  subspecialty: string | null;
  public_bio: string | null;
  public_languages: string[] | null;
  public_consultation_type: string | null;
  public_consultation_fee_php: number | null;
  public_booking_mode: string | null;
  clinic_name: string | null;
  city: string | null;
};

type ExternalProvider = {
  id: string;
  full_name: string;
  credentials: string | null;
  specialty: string | null;
  subspecialty: string | null;
  clinic_name: string | null;
  hospital: string | null;
  city: string | null;
  contact_number: string | null;
  source: string;
  source_url: string | null;
};

const NAVY = "#0c1730";

export function DirectorySearch({ providers, externalProviders }: { providers: Provider[]; externalProviders: ExternalProvider[] }) {
  const [filter, setFilter] = useState<"all" | "angelclinic" | "other">("all");
  const [query, setQuery] = useState("");
  const [requestingFor, setRequestingFor] = useState<Provider | null>(null);

  const q = query.trim().toLowerCase();
  const matchesQuery = (haystack: (string | null | undefined)[]) =>
    q === "" || haystack.some((h) => (h ?? "").toLowerCase().includes(q));

  const filteredProviders = useMemo(
    () =>
      filter === "other"
        ? []
        : providers.filter((p) => matchesQuery([p.full_name, p.specialty, p.subspecialty, p.city, p.clinic_name])),
    [providers, filter, q]
  );
  const filteredExternal = useMemo(
    () =>
      filter === "angelclinic"
        ? []
        : externalProviders.filter((p) => matchesQuery([p.full_name, p.specialty, p.subspecialty, p.city, p.clinic_name, p.hospital])),
    [externalProviders, filter, q]
  );

  const totalShown = filteredProviders.length + filteredExternal.length;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <input
          placeholder="Search by name, specialty, or city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 260px", padding: "11px 14px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14 }}
        />
        <div style={{ display: "inline-flex", background: "#eef0f3", borderRadius: 999, padding: 4 }}>
          {(
            [
              ["all", "All"],
              ["angelclinic", "AngelClinic Providers"],
              ["other", "Other Providers"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                border: "none",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                background: filter === value ? NAVY : "transparent",
                color: filter === value ? "#e6c66b" : "#555",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {totalShown === 0 && (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 28, textAlign: "center", color: "#888", fontSize: 13.5 }}>
          No providers match your search yet.
        </div>
      )}

      {filteredProviders.length > 0 && (
        <div style={{ display: "grid", gap: 12, marginBottom: filteredExternal.length > 0 ? 32 : 0 }}>
          {filteredProviders.map((p) => (
            <div key={p.id} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: NAVY }}>
                    {p.title ? `${p.title} ` : ""}
                    {p.full_name}
                    <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#1a7f37", background: "#e6f4ea", padding: "2px 8px", borderRadius: 999, verticalAlign: "middle" }}>
                      AngelClinic
                    </span>
                  </div>
                  <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                    {[p.specialty, p.subspecialty].filter(Boolean).join(" · ") || "General practice"}
                  </div>
                  <div style={{ color: "#999", fontSize: 12.5, marginTop: 2 }}>
                    {[p.clinic_name, p.city].filter(Boolean).join(" · ")}
                  </div>
                  {p.public_bio && <p style={{ color: "#555", fontSize: 12.5, lineHeight: 1.6, margin: "8px 0 0", maxWidth: 480 }}>{p.public_bio}</p>}
                  {p.public_consultation_fee_php != null && (
                    <div style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
                      Consultation ({p.public_consultation_type || "in-person"}): ₱{Number(p.public_consultation_fee_php).toLocaleString()}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  {p.public_booking_mode === "request" ? (
                    <button
                      onClick={() => setRequestingFor(p)}
                      style={{ background: NAVY, color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      Request Appointment
                    </button>
                  ) : p.public_booking_mode === "real_time" ? (
                    <span style={{ fontSize: 11.5, color: "#c99a2e", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 8, padding: "8px 12px", whiteSpace: "nowrap" }}>
                      Real-time booking — coming soon
                    </span>
                  ) : (
                    <span style={{ fontSize: 11.5, color: "#999" }}>Call the clinic to book</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredExternal.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredExternal.map((p) => (
            <div key={p.id} style={{ background: "#f8f8f6", border: "1px solid #e6e6e2", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>
                {p.full_name}
                {p.credentials && <span style={{ fontWeight: 400, color: "#888" }}> · {p.credentials}</span>}
              </div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>{[p.specialty, p.subspecialty].filter(Boolean).join(" · ")}</div>
              <div style={{ color: "#999", fontSize: 12.5, marginTop: 2 }}>{[p.clinic_name || p.hospital, p.city].filter(Boolean).join(" · ")}</div>
              {p.contact_number && <div style={{ color: "#999", fontSize: 12.5, marginTop: 2 }}>{p.contact_number}</div>}
              <div style={{ color: "#aaa", fontSize: 11, marginTop: 8 }}>
                Externally listed — not an AngelClinic user. Source: {p.source_url ? <a href={p.source_url} target="_blank" rel="noreferrer" style={{ color: "#aaa" }}>{p.source}</a> : p.source}
              </div>
            </div>
          ))}
        </div>
      )}

      {requestingFor && (
        <AppointmentRequestForm provider={requestingFor} onClose={() => setRequestingFor(null)} />
      )}
    </div>
  );
}
