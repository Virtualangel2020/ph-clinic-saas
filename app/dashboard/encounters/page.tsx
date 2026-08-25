import Link from "next/link";
import { requireClinicMember } from "@/lib/require-clinic-member";
import { EncountersClient } from "./encounters-client";
import { DateNav } from "./date-nav";
import { MonthMiniCalendar } from "./month-mini-calendar";
import { FilterBar } from "./filter-bar";
import { EncounterSelectionList, type SelectableEncounterRow } from "./encounter-selection-list";
import { SearchPanel } from "./search-panel";
import { todayPh, phDayStart, addDays, monthGridStart, monthGridEnd, startOfMonth } from "../calendar/date-utils";

// Date-organized Encounters module (spec "ENCOUNTER HISTORY, PDF EXPORT &
// PROVIDER SHARING UPDATE" §1-3, §14, §19-22): a selected date is the
// default and primary view — never one long undifferentiated list — with a
// month mini-calendar (dot indicators), optional filters, multi-select +
// combined PDF export, and a separate Search Encounters mode for older
// notes. The patient-chart's own Encounters section (app/dashboard/patients/
// [id]/encounter-history-section.tsx) is the OTHER, single-patient way to
// reach this data — this page is the clinic-wide, date-first one.
export default async function EncountersPage({
  searchParams,
}: {
  searchParams: { date?: string; month?: string; provider?: string; type?: string; status?: string; mode?: string; patient?: string };
}) {
  const { supabase, profile } = await requireClinicMember();
  const today = todayPh();
  const date = searchParams.date || today;
  const monthAnchor = searchParams.month || startOfMonth(date);
  const providerFilter = searchParams.provider || "";
  const typeFilter = searchParams.type || "";
  const statusFilter = searchParams.status || "";
  const searchMode = searchParams.mode === "search";

  let encountersQuery = supabase
    .from("encounters")
    .select(
      "id, patient_id, encounter_date, encounter_type, chief_complaint, status, signed_at, patients(first_name, last_name), user_profiles!encounters_provider_id_fkey(full_name)"
    )
    .eq("tenant_id", profile.tenant_id)
    .eq("encounter_date", date)
    .order("created_at", { ascending: true });
  if (providerFilter) encountersQuery = encountersQuery.eq("provider_id", providerFilter);
  if (typeFilter) encountersQuery = encountersQuery.eq("encounter_type", typeFilter);
  if (statusFilter) encountersQuery = encountersQuery.eq("status", statusFilter);

  const [
    { data: encountersForDate },
    { data: monthEncounters },
    { data: providers },
    { data: patients },
    { data: appointmentTypes },
    { data: todaysAppointments },
    { data: clinicSettings },
  ] = await Promise.all([
    encountersQuery,
    // Lightweight — dates only — used solely for the mini-calendar's dot
    // indicators, never the encounters themselves.
    supabase
      .from("encounters")
      .select("encounter_date")
      .eq("tenant_id", profile.tenant_id)
      .gte("encounter_date", monthGridStart(monthAnchor))
      .lt("encounter_date", monthGridEnd(monthAnchor)),
    supabase.from("user_profiles").select("id, full_name, title").eq("tenant_id", profile.tenant_id).eq("role", "doctor").eq("is_active", true).order("full_name"),
    supabase.from("patients").select("id, first_name, middle_name, last_name, mobile_phone").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("last_name").order("first_name"),
    supabase.from("appointment_types").select("id, name").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("sort_order"),
    supabase
      .from("appointments")
      .select("id, patient_id, provider_id, start_at, status, patients(first_name,last_name)")
      .eq("tenant_id", profile.tenant_id)
      .gte("start_at", phDayStart(today))
      .lt("start_at", phDayStart(addDays(today, 1)))
      .in("status", ["scheduled", "confirmed", "checked_in"])
      .order("start_at"),
    supabase.from("clinic_settings").select("clinic_name").eq("tenant_id", profile.tenant_id).maybeSingle(),
  ]);
  const clinicName = clinicSettings?.clinic_name ?? "your clinic";

  const encounterDates = Array.from(new Set(((monthEncounters as any[]) ?? []).map((e) => e.encounter_date)));

  const selectableRows: SelectableEncounterRow[] = ((encountersForDate as any[]) ?? []).map((e) => ({
    id: e.id,
    patient_id: e.patient_id,
    patient_name: e.patients ? `${e.patients.last_name}, ${e.patients.first_name}` : null,
    provider_name: e.user_profiles?.full_name ?? null,
    encounter_type: e.encounter_type,
    chief_complaint: e.chief_complaint,
    status: e.status,
    signed_at: e.signed_at ?? null,
    encounter_date: e.encounter_date,
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Encounters</h1>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 0 }}>
            Every clinical visit, organized by date. Vitals and SOAP notes are documented inside each encounter and also
            show up on the patient's chart.
          </p>
        </div>
        <Link
          href={searchMode ? "/dashboard/encounters" : "/dashboard/encounters?mode=search"}
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", textDecoration: "none", whiteSpace: "nowrap" }}
        >
          {searchMode ? "← Back to date view" : "🔍 Search Encounters"}
        </Link>
      </div>

      <div style={{ margin: "16px 0" }}>
        <EncountersClient
          providers={(providers as any) ?? []}
          patients={(patients as any) ?? []}
          appointmentTypes={(appointmentTypes as any) ?? []}
          todaysAppointments={(todaysAppointments as any) ?? []}
          prefillPatientId={searchParams.patient ?? null}
        />
      </div>

      {searchMode ? (
        <div>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>Search Encounters</h2>
          <SearchPanel providers={(providers as any) ?? []} appointmentTypes={(appointmentTypes as any) ?? []} clinicName={clinicName} />
        </div>
      ) : (
        <div className="encounters-grid" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>
          <MonthMiniCalendar monthAnchor={monthAnchor} selectedDate={date} encounterDates={encounterDates} />

          <div>
            <DateNav date={date} />
            <FilterBar
              date={date}
              providerId={providerFilter}
              encounterType={typeFilter}
              status={statusFilter}
              providers={(providers as any) ?? []}
              appointmentTypes={(appointmentTypes as any) ?? []}
            />
            <EncounterSelectionList
              rows={selectableRows}
              emptyMessage={providerFilter || typeFilter || statusFilter ? "No encounters match these filters for this date." : "No encounters recorded for this date yet."}
              clinicName={clinicName}
            />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 700px) {
          .encounters-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
