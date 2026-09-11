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
  photo_url: string | null;
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
  hmo_names: string[] | null;
};

const NAVY = "var(--brand-primary)";

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
function providerInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((s) => s.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// public_consultation_type already existed on user_profiles before this
// pass (only "in_person" and "both" are in use today, per a live check —
// "telehealth" is a valid third value the column already supports). This
// derives the doctor-card visit-mode badge and filter purely from that
// existing field — no schema change needed for this part of the spec.
function visitModes(p: Provider): { inPerson: boolean; telehealth: boolean } {
  const t = p.public_consultation_type;
  if (t === "telehealth") return { inPerson: false, telehealth: true };
  if (t === "both") return { inPerson: true, telehealth: true };
  return { inPerson: true, telehealth: false }; // null/"in_person"/anything else defaults to in-person
}
function visitModeLabel(p: Provider): string {
  const { inPerson, telehealth } = visitModes(p);
  if (inPerson && telehealth) return "In-Person • Telehealth";
  if (telehealth) return "Telehealth";
  return "In-Person";
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
const VISIT_MODE_FILTERS = [
  { value: "in_person", label: "In-Person" },
  { value: "telehealth", label: "Telehealth" },
];

export function DirectorySearch({
  providers,
  externalProviders,
  basePath = "/find-a-doctor",
  bookHref,
}: {
  providers: Provider[];
  externalProviders: ExternalProvider[];
  // Lets the SAME directory UI/data be reused inside the Patient Portal
  // (app/portal/find-a-doctor) without a second copy: basePath swaps
  // where the provider name / "View Profile" link points (the public
  // page's own provider profile vs. the portal-shelled one), and bookHref
  // — when provided — replaces the public "Request Appointment (no
  // account needed)" modal with a direct link to the real in-portal
  // booking flow, since a signed-in patient never needs the anonymous
  // request form. Omitting both keeps the public page's behavior exactly
  // as it was.
  basePath?: string;
  bookHref?: (providerId: string) => string;
}) {
  const [filter, setFilter] = useState<"all" | "angelclinic" | "other">("all");
  const [query, setQuery] = useState("");
  const [bookingFilters, setBookingFilters] = useState<Set<string>>(new Set());
  const [coverageFilters, setCoverageFilters] = useState<Set<string>>(new Set());
  const [visitModeFilters, setVisitModeFilters] = useState<Set<string>>(new Set());
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
  const matchesVisitMode = (p: Provider) => {
    if (visitModeFilters.size === 0) return true;
    const { inPerson, telehealth } = visitModes(p);
    return (visitModeFilters.has("in_person") && inPerson) || (visitModeFilters.has("telehealth") && telehealth);
  };

  const filteredProviders = useMemo(
    () =>
      filter === "other"
        ? []
        : providers.filter(
            (p) => matchesQuery([p.full_name, p.specialty, p.subspecialty, p.city, p.clinic_name]) && matchesBooking(p) && matchesCoverage(p) && matchesVisitMode(p)
          ),
    [providers, filter, q, bookingFilters, coverageFilters, visitModeFilters]
  );
  const filteredExternal = useMemo(
    () =>
      filter === "angelclinic" || bookingFilters.size > 0 || coverageFilters.size > 0 || visitModeFilters.size > 0
        ? []
        : externalProviders.filter((p) => matchesQuery([p.full_name, p.specialty, p.subspecialty, p.city, p.clinic_name, p.hospital])),
    [externalProviders, filter, q, bookingFilters, coverageFilters, visitModeFilters]
  );

  // Zero MyCareDesk providers (or zero external providers) is a completely
  // normal, expected state — not an error, and not the same thing as "your
  // search/filters matched nothing." These two are kept explicitly
  // distinct everywhere below: "not currently available" for a directory
  // that's really empty vs. "match your search" for filters that hid
  // everything. The two sections (MyCareDesk / External) are rendered
  // independently of each other so one being empty never hides or gates
  // the other.
  const hasSearchOrFilters = q !== "" || bookingFilters.size > 0 || coverageFilters.size > 0 || visitModeFilters.size > 0;
  const hasActiveFilters = hasSearchOrFilters || filter !== "all";
  const hasAnyProviders = providers.length > 0;
  const hasAnyExternal = externalProviders.length > 0;
  const nothingInDirectoryAtAll = !hasAnyProviders && !hasAnyExternal;

  const showMyCareDeskSection = filter === "all" || filter === "angelclinic";
  const showExternalSection = filter === "all" || filter === "other";

  // null means "don't show an empty-state box at all" — used for spec
  // scenario 12(b): MyCareDesk providers exist and external doesn't, so
  // the External section is simply omitted rather than shown empty.
  const myCareDeskEmptyMessage: string | null =
    filteredProviders.length > 0
      ? null
      : !hasAnyProviders
      ? hasSearchOrFilters
        ? "No MyCareDesk providers match your search."
        : hasAnyExternal
        ? "None of the listed doctors are currently using MyCareDesk for online booking, but you can still view their directory information."
        : "No MyCareDesk providers are currently available."
      : "No MyCareDesk providers match your search.";

  const externalEmptyMessage: string | null =
    filteredExternal.length > 0
      ? null
      : !hasAnyExternal
      ? hasSearchOrFilters
        ? "No external providers match your search."
        : hasAnyProviders
        ? null
        : "No external providers are currently available."
      : "No external providers match your search.";

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setBookingFilters(new Set());
    setCoverageFilters(new Set());
    setVisitModeFilters(new Set());
  }

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
              ["angelclinic", "MyCareDesk"],
              ["other", "External"],
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
                color: filter === value ? "var(--brand-secondary)" : "#555",
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
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "#999", fontWeight: 600 }}>Visit:</span>
          {VISIT_MODE_FILTERS.map((f) => (
            <FilterChip key={f.value} active={visitModeFilters.has(f.value)} label={f.label} onClick={() => toggleSet(visitModeFilters, setVisitModeFilters, f.value)} />
          ))}
        </div>
      </div>

      {/* Zero providers of EITHER kind, with nothing hidden by an active
          filter, is a normal directory state (spec: "no doctors have been
          added yet"), not an error — render one plain message and stop,
          rather than two empty sections stacked on top of each other. */}
      {nothingInDirectoryAtAll && (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 28, textAlign: "center", color: "#888", fontSize: 13.5 }}>
          No doctors have been added to the directory yet.
        </div>
      )}

      {!nothingInDirectoryAtAll && showMyCareDeskSection && (
        <div style={{ marginBottom: showExternalSection && (filteredExternal.length > 0 || externalEmptyMessage) ? 32 : 0 }}>
          {filter === "all" && <SectionLabel>MyCareDesk Providers</SectionLabel>}

          {myCareDeskEmptyMessage && (
            <EmptySection>
              {myCareDeskEmptyMessage}
              {hasActiveFilters && hasAnyProviders && (
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={clearFilters}
                    style={{ background: "white", color: NAVY, fontWeight: 600, fontSize: 12.5, padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </EmptySection>
          )}

          {filteredProviders.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredProviders.map((p) => {
            const bookingType = effectiveBookingType(p);
            const canRequest = bookingType === "appointment" || bookingType === "both" || bookingType === "appointment_request";
            return (
              <div key={p.id} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: NAVY,
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt={p.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        providerInitials(p.full_name)
                      )}
                    </div>
                    <div>
                      <Link href={`${basePath}/${p.id}`} style={{ textDecoration: "none" }}>
                        <div style={{ fontWeight: 700, fontSize: 15.5, color: NAVY }}>
                          {p.title ? `${p.title} ` : ""}
                          {p.full_name}
                          <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#1a7f37", background: "#e6f4ea", padding: "2px 8px", borderRadius: 999, verticalAlign: "middle" }}>
                            MyCareDesk Provider
                          </span>
                        </div>
                      </Link>
                      <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>{[p.specialty, p.subspecialty].filter(Boolean).join(" · ") || "General practice"}</div>
                      <div style={{ color: "#999", fontSize: 12.5, marginTop: 2 }}>{[p.clinic_name, p.city].filter(Boolean).join(" · ")}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        <div style={{ fontSize: 11.5, color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 999, padding: "2px 9px" }}>
                          {BOOKING_TYPE_LABEL[bookingType] ?? bookingType}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#1a5c8c", background: "#eaf3fb", border: "1px solid #bcd9f0", borderRadius: 999, padding: "2px 9px" }}>
                          {visitModeLabel(p)}
                        </div>
                      </div>
                      {p.public_bio && <p style={{ color: "#555", fontSize: 12.5, lineHeight: 1.6, margin: "8px 0 0", maxWidth: 480 }}>{p.public_bio}</p>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <Link
                      href={`${basePath}/${p.id}`}
                      style={{ fontSize: 12, fontWeight: 600, color: NAVY, border: "1px solid #ddd", borderRadius: 8, padding: "7px 14px", textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                      View Profile
                    </Link>
                    {canRequest &&
                      (bookHref ? (
                        <Link
                          href={bookHref(p.id)}
                          style={{
                            background: NAVY,
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 12.5,
                            padding: "9px 16px",
                            borderRadius: 8,
                            border: "none",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                            display: "inline-block",
                          }}
                        >
                          Book Appointment
                        </Link>
                      ) : (
                        <button
                          onClick={() => setRequestingFor(p)}
                          style={{ background: NAVY, color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          Request Appointment
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          )}
        </div>
      )}

      {!nothingInDirectoryAtAll && showExternalSection && (
        <div>
          {filter === "all" && <SectionLabel>External Providers</SectionLabel>}

          {externalEmptyMessage && (
            <EmptySection>
              {externalEmptyMessage}
              {hasActiveFilters && hasAnyExternal && (
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={clearFilters}
                    style={{ background: "white", color: NAVY, fontWeight: 600, fontSize: 12.5, padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </EmptySection>
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
                      <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#8a6d1f", background: "#fbf1d8", padding: "2px 8px", borderRadius: 999, verticalAlign: "middle" }}>
                        External Provider
                      </span>
                    </div>
                    <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>{[p.specialty, p.subspecialty].filter(Boolean).join(" · ")}</div>
                    <div style={{ color: "#999", fontSize: 12.5, marginTop: 2 }}>{[p.clinic_name || p.hospital, p.address || p.city].filter(Boolean).join(" · ")}</div>
                    {p.hmo_names && p.hmo_names.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                        {p.hmo_names.map((h) => (
                          <span key={h} style={{ fontSize: 11, color: "#1a5c8c", background: "#eaf3fb", border: "1px solid #bcd9f0", borderRadius: 999, padding: "2px 8px" }}>
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.schedule_text && <div style={{ color: "#666", fontSize: 12, marginTop: 6, whiteSpace: "pre-line" }}>{p.schedule_text}</div>}
                    <div style={{ color: "#aaa", fontSize: 11, marginTop: 8 }}>
                      Not yet on MyCareDesk — this doctor doesn't have online booking or messaging here. Directory source:{" "}
                      {p.source_url ? (
                        <a href={p.source_url} target="_blank" rel="noreferrer" style={{ color: "#aaa" }}>
                          {p.source}
                        </a>
                      ) : (
                        p.source
                      )}
                    </div>
                  </div>
                  {p.contact_number && (
                    <div style={{ flexShrink: 0 }}>
                      <a
                        href={`tel:${p.contact_number.replace(/[^+\d]/g, "")}`}
                        style={{ fontSize: 12, fontWeight: 600, color: NAVY, border: "1px solid #ddd", borderRadius: 8, padding: "7px 14px", textDecoration: "none", whiteSpace: "nowrap", display: "inline-block", background: "white" }}
                      >
                        Call Clinic
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {requestingFor && <AppointmentRequestForm provider={requestingFor} onClose={() => setRequestingFor(null)} />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>{children}</div>;
}

function EmptySection({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 22, textAlign: "center", color: "#888", fontSize: 13.5 }}>
      {children}
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
        color: active ? "var(--brand-secondary)" : "#555",
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
