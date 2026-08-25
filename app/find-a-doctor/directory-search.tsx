"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppointmentRequestForm } from "./appointment-request-form";
import { resolveEffectiveSettings, BOOKING_TYPE_LABEL, supportsSlotBooking } from "@/lib/patient-access";

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
  default_booking_type: string | null;
  booking_type_override: string | null;
  clinic_accept_hmo: boolean | null;
  accept_hmo_override: boolean | null;
  clinic_accept_yakap: boolean | null;
  accept_yakap_override: boolean | null;
  accept_online_payments: boolean | null;
  clinic_messaging_enabled: boolean | null;
  messaging_enabled_override: boolean | null;
};

type ExternalProvider = {
  id: string;
  full_name: string;
  credentials: string | null;
  specialty: string | null;
  subspecialty: string | null;
  clinic_name: string | null;
  hospital: string | null;
  address: string | null;
  city: string | null;
  contact_number: string | null;
  photo_url: string | null;
  schedule_text: string | null;
  source: string;
  source_url: string | null;
};

const NAVY = "#0c1730";

function effectiveBookingType(p: Provider): string {
  return p.booking_type_override ?? p.default_booking_type ?? "both";
}
function effectiveAcceptHmo(p: Provider): boolean {
  return p.accept_hmo_override ?? p.clinic_accept_hmo ?? false;
}
function effectiveAcceptYakap(p: Provider): boolean {
  return p.accept_yakap_override ?? p.clinic_accept_yakap ?? false;
}
function effectiveMessaging(p: Provider): boolean {
  return p.messaging_enabled_override ?? p.clinic_messaging_enabled ?? false;
}

const BOOKING_FILTERS = [
  { value: "walk_in", label: "Walk-In" },
  { value: "appointment", label: "Appointment" },
  { value: "online", label: "Online Booking" },
];
const COVERAGE_FILTERS = [
  { value: "hmo", label: "HMO" },
  { value: "yakap", label: "YAKAP" },
  { value: "online_payment", label: "Online Payment" },
];

export function DirectorySearch({ providers, externalProviders }: { providers: Provider[]; externalProviders: ExternalProvider[] }) {
  const [filter, setFilter] = useState<"all" | "angelclinic" | "other">("all");
  const [query, setQuery] = useState("");
  const [bookingFilters, setBookingFilters] = useState<Set<string>>(new Set());
  const [coverageFilters, setCoverageFilters] = useState<Set<string>>(new Set());
  const [requestingFor, setRequestingFor] = useState<Provider | null>(null);

  function toggleSet(set: Set<string>, setter: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  }

  const q = query.trim().toLowerCase();
  const matchesQuery = (haystack: (string | null | undefined)[]) => q === "" || haystack.some((h) => (h ?? "").toLowerCase().includes(q));

  const matchesBooking = (p: Provider) => {
    if (bookingFilters.size === 0) return true;
    const bt = effectiveBookingType(p);
    return (
      (bookingFilters.has("walk_in") && (bt === "walk_in" || bt === "both")) ||
      (bookingFilters.has("appointment") && (bt === "appointment" || bt === "both" || bt === "appointment_request")) ||
      (bookingFilters.has("online") && supportsSlotBooking(bt))
    );
  };
  const matchesCoverage = (p: Provider) => {
    if (coverageFilters.size === 0) return true;
    return (
      (coverageFilters.has("hmo") && effectiveAcceptHmo(p)) ||
      (coverageFilters.has("yakap") && effectiveAcceptYakap(p)) ||
      (coverageFilters.has("online_payment") && !!p.accept_online_payments)
    );
  };

  const filteredProviders = useMemo(
    () =>
      filter === "other"
        ? []
        : providers.filter((p) => matchesQuery([p.full_name, p.specialty, p.subspecialty, p.city, p.clinic_name]) && matchesBooking(p) && matchesCoverage(p)),
    [providers, filter, q, bookingFilters, coverageFilters]
  );
  const filteredExternal = useMemo(
    () =>
      filter === "angelclinic" || bookingFilters.size > 0 || coverageFilters.size > 0
        ? []
        : externalProviders.filter((p) => matchesQuery([p.full_name, p.specialty, p.subspecialty, p.city, p.clinic_name, p.hospital])),
    [externalProviders, filter, q, bookingFilters, coverageFilters]
  );

  const totalShown = filteredProviders.length + filteredExternal.length;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <input
          placeholder="Search by name, specialty, or city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 260px", padding: "11px 14px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14 }}
        />
        <div style={{ display: "inline-flex", flexWrap: "wrap", background: "#eef0f3", borderRadius: 999, padding: 4 }}>
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

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20, fontSize: 12 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "#999", fontWeight: 600 }}>Booking:</span>
          {BOOKING_FILTERS.map((f) => (
            <FilterChip key={f.value} active={bookingFilters.has(f.value)} label={f.label} onClick={() => toggleSet(bookingFilters, setBookingFilters, f.value)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "#999", fontWeight: 600 }}>Coverage:</span>
          {COVERAGE_FILTERS.map((f) => (
            <FilterChip key={f.value} active={coverageFilters.has(f.value)} label={f.label} onClick={() => toggleSet(coverageFilters, setCoverageFilters, f.value)} />
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
          {filteredProviders.map((p) => {
            const bookingType = effectiveBookingType(p);
            const canRequest = bookingType === "appointment" || bookingType === "both" || bookingType === "appointment_request";
            return (
              <div key={p.id} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <Link href={`/find-a-doctor/${p.id}`} style={{ textDecoration: "none" }}>
                      <div style={{ fontWeight: 700, fontSize: 15.5, color: NAVY }}>
                        {p.title ? `${p.title} ` : ""}
                        {p.full_name}
                        <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#1a7f37", background: "#e6f4ea", padding: "2px 8px", borderRadius: 999, verticalAlign: "middle" }}>
                          AngelClinic
                        </span>
                      </div>
                    </Link>
                    <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>{[p.specialty, p.subspecialty].filter(Boolean).join(" · ") || "General practice"}</div>
                    <div style={{ color: "#999", fontSize: 12.5, marginTop: 2 }}>{[p.clinic_name, p.city].filter(Boolean).join(" · ")}</div>
                    <div style={{ fontSize: 11.5, color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 999, padding: "2px 9px", display: "inline-block", marginTop: 8 }}>
                      {BOOKING_TYPE_LABEL[bookingType] ?? bookingType}
                    </div>
                    {p.public_bio && <p style={{ color: "#555", fontSize: 12.5, lineHeight: 1.6, margin: "8px 0 0", maxWidth: 480 }}>{p.public_bio}</p>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <Link
                      href={`/find-a-doctor/${p.id}`}
                      style={{ fontSize: 12, fontWeight: 600, color: NAVY, border: "1px solid #ddd", borderRadius: 8, padding: "7px 14px", textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                      View Profile
                    </Link>
                    {canRequest && (
                      <button
                        onClick={() => setRequestingFor(p)}
                        style={{ background: NAVY, color: "#e6c66b", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Request Appointment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredExternal.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredExternal.map((p) => (
            <div key={p.id} style={{ background: "#f8f8f6", border: "1px solid #e6e6e2", borderRadius: 12, padding: "18px 20px", display: "flex", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: "#eee", flexShrink: 0 }}>
                {p.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt={p.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>
                  {p.full_name}
                  {p.credentials && <span style={{ fontWeight: 400, color: "#888" }}> · {p.credentials}</span>}
                </div>
                <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>{[p.specialty, p.subspecialty].filter(Boolean).join(" · ")}</div>
                <div style={{ color: "#999", fontSize: 12.5, marginTop: 2 }}>{[p.clinic_name || p.hospital, p.address || p.city].filter(Boolean).join(" · ")}</div>
                {p.contact_number && <div style={{ color: "#999", fontSize: 12.5, marginTop: 2 }}>{p.contact_number}</div>}
                {p.schedule_text && <div style={{ color: "#666", fontSize: 12, marginTop: 6, whiteSpace: "pre-line" }}>{p.schedule_text}</div>}
                <div style={{ color: "#aaa", fontSize: 11, marginTop: 8 }}>
                  Externally listed — not an AngelClinic user. Source:{" "}
                  {p.source_url ? (
                    <a href={p.source_url} target="_blank" rel="noreferrer" style={{ color: "#aaa" }}>
                      {p.source}
                    </a>
                  ) : (
                    p.source
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {requestingFor && <AppointmentRequestForm provider={requestingFor} onClose={() => setRequestingFor(null)} />}
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 11px",
        borderRadius: 999,
        border: `1px solid ${active ? NAVY : "#ddd"}`,
        background: active ? NAVY : "white",
        color: active ? "#e6c66b" : "#555",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
