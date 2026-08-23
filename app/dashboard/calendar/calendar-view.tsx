"use client";

import { useState } from "react";
import Link from "next/link";
import { AppointmentForm } from "./appointment-form";
import { addDays, formatDayLabel, formatMonthLabel, formatTime, monthGridStart, startOfMonth, startOfWeek, todayPh } from "./date-utils";

type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string; color: string; default_duration_minutes: number };
type Patient = { id: string; first_name: string; middle_name: string | null; last_name: string; mobile_phone: string | null };

type Appointment = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  appointment_type_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
  notes: string | null;
  patients: { first_name: string; last_name: string } | null;
  user_profiles: { full_name: string } | null;
  appointment_types: { name: string; color: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
const STATUS_COLOR: Record<string, string> = {
  scheduled: "#666",
  confirmed: "#1a6fc4",
  checked_in: "#8a6100",
  completed: "#1a7f37",
  cancelled: "#a12a2a",
  no_show: "#a12a2a",
};

export function CalendarView({
  view,
  anchor,
  providers,
  appointmentTypes,
  patients,
  appointments,
}: {
  view: "day" | "week" | "month";
  anchor: string;
  providers: Provider[];
  appointmentTypes: ApptType[];
  patients: Patient[];
  appointments: Appointment[];
}) {
  const [formState, setFormState] = useState<{ open: boolean; date: string; editingId: string | null }>({ open: false, date: anchor, editingId: null });

  function openNew(date: string) {
    setFormState({ open: true, date, editingId: null });
  }
  function openEdit(a: Appointment) {
    setFormState({ open: true, date: anchor, editingId: a.id });
  }
  function close() {
    setFormState((s) => ({ ...s, open: false, editingId: null }));
  }

  const editing = formState.editingId ? appointments.find((a) => a.id === formState.editingId) ?? null : null;
  const editingForForm = editing
    ? {
        id: editing.id,
        patient_id: editing.patient_id,
        provider_id: editing.provider_id,
        appointment_type_id: editing.appointment_type_id,
        start_at: editing.start_at,
        end_at: editing.end_at,
        status: editing.status,
        notes: editing.notes,
      }
    : null;

  function href(v: "day" | "week" | "month", d: string) {
    return `/dashboard/calendar?view=${v}&date=${d}`;
  }

  let prevHref: string, nextHref: string, todayHref: string, rangeLabel: string;
  if (view === "day") {
    prevHref = href("day", addDays(anchor, -1));
    nextHref = href("day", addDays(anchor, 1));
    rangeLabel = formatDayLabel(anchor);
  } else if (view === "week") {
    const ws = startOfWeek(anchor);
    prevHref = href("week", addDays(ws, -7));
    nextHref = href("week", addDays(ws, 7));
    rangeLabel = `${formatDayLabel(ws)} – ${formatDayLabel(addDays(ws, 6))}`;
  } else {
    prevHref = href("month", addDays(startOfMonth(anchor), -1));
    nextHref = href("month", addDays(startOfMonth(anchor), 32));
    rangeLabel = formatMonthLabel(anchor);
  }
  todayHref = href(view, todayPh());

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <NavButton href={prevHref}>‹</NavButton>
          <NavButton href={todayHref}>Today</NavButton>
          <NavButton href={nextHref}>›</NavButton>
          <div style={{ fontWeight: 700, fontSize: 15, marginLeft: 8 }}>{rangeLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
            {(["day", "week", "month"] as const).map((v) => (
              <Link
                key={v}
                href={href(v, anchor)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: "none",
                  color: view === v ? "white" : "#555",
                  background: view === v ? "#0c1730" : "white",
                  textTransform: "capitalize",
                }}
              >
                {v}
              </Link>
            ))}
          </div>
          <button
            onClick={() => openNew(anchor)}
            style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            + New appointment
          </button>
        </div>
      </div>

      {formState.open && (
        <AppointmentForm
          defaultDate={formState.date}
          editing={editingForForm}
          providers={providers}
          appointmentTypes={appointmentTypes}
          patients={patients}
          onClose={close}
        />
      )}

      {providers.length === 0 && (
        <div style={{ background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13, color: "#8a6100" }}>
          No active doctors on your team yet — add one under Settings → Users before booking appointments.
        </div>
      )}

      {view === "day" && <DayView providers={providers} appointments={appointments} onOpen={openEdit} />}
      {view === "week" && <WeekView weekStart={startOfWeek(anchor)} appointments={appointments} onOpen={openEdit} onAddFor={openNew} />}
      {view === "month" && <MonthView anchor={anchor} appointments={appointments} />}
    </div>
  );
}

function NavButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 34, height: 32, padding: "0 10px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none", color: "#333", fontSize: 12.5, fontWeight: 600, background: "white" }}
    >
      {children}
    </Link>
  );
}

function AppointmentChip({ a, onClick }: { a: Appointment; onClick: () => void }) {
  const color = a.appointment_types?.color ?? "#888";
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "white",
        border: `1px solid #e2e2e5`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 6,
        padding: "6px 9px",
        fontSize: 12.5,
        cursor: "pointer",
        marginBottom: 5,
        opacity: a.status === "cancelled" || a.status === "no_show" ? 0.55 : 1,
      }}
    >
      <div style={{ fontWeight: 700, color: "#0c1730", whiteSpace: "nowrap" }}>{formatTime(a.start_at)}</div>
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {a.patients ? `${a.patients.last_name}, ${a.patients.first_name}` : "Unknown patient"}
        {a.appointment_types && <span style={{ color: "#999" }}> · {a.appointment_types.name}</span>}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_COLOR[a.status] ?? "#666", whiteSpace: "nowrap" }}>{STATUS_LABEL[a.status] ?? a.status}</div>
    </div>
  );
}

function DayView({
  providers,
  appointments,
  onOpen,
}: {
  providers: Provider[];
  appointments: Appointment[];
  onOpen: (a: Appointment) => void;
}) {
  const unassigned = appointments.filter((a) => !a.provider_id);
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: providers.length > 1 ? "repeat(auto-fit, minmax(240px, 1fr))" : "1fr" }}>
      {providers.map((p) => {
        const mine = appointments.filter((a) => a.provider_id === p.id);
        return (
          <div key={p.id} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0c1730", marginBottom: 8 }}>
              {p.title ? `${p.title} ` : ""}
              {p.full_name}
            </div>
            {mine.length === 0 ? (
              <p style={{ color: "#999", fontSize: 12 }}>No appointments.</p>
            ) : (
              mine.map((a) => <AppointmentChip key={a.id} a={a} onClick={() => onOpen(a)} />)
            )}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0c1730", marginBottom: 8 }}>Unassigned</div>
          {unassigned.map((a) => (
            <AppointmentChip key={a.id} a={a} onClick={() => onOpen(a)} />
          ))}
        </div>
      )}

      {providers.length === 0 && appointments.length > 0 && (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 12 }}>
          {appointments.map((a) => (
            <AppointmentChip key={a.id} a={a} onClick={() => onOpen(a)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WeekView({
  weekStart,
  appointments,
  onOpen,
  onAddFor,
}: {
  weekStart: string;
  appointments: Appointment[];
  onOpen: (a: Appointment) => void;
  onAddFor: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {days.map((d) => {
        const dayAppts = appointments.filter((a) => isSamePhDay(a.start_at, d));
        const isToday = d === todayPh();
        return (
          <div key={d} style={{ background: "white", border: `1px solid ${isToday ? "#0c1730" : "#e2e2e5"}`, borderRadius: 10, padding: 10, minHeight: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: isToday ? "#0c1730" : "#555" }}>{formatDayLabel(d)}</div>
              <button onClick={() => onAddFor(d)} title="Add appointment" style={{ background: "none", border: "none", color: "#0c1730", cursor: "pointer", fontSize: 15, fontWeight: 700, lineHeight: 1 }}>
                +
              </button>
            </div>
            {dayAppts.length === 0 ? (
              <p style={{ color: "#bbb", fontSize: 11.5 }}>—</p>
            ) : (
              dayAppts.map((a) => <AppointmentChip key={a.id} a={a} onClick={() => onOpen(a)} />)
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ anchor, appointments }: { anchor: string; appointments: Appointment[] }) {
  const gridStart = monthGridStart(anchor);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const currentMonth = anchor.slice(0, 7);
  const today = todayPh();

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 4 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} style={{ fontSize: 11, fontWeight: 700, color: "#888", textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {days.map((d) => {
          const dayAppts = appointments.filter((a) => isSamePhDay(a.start_at, d));
          const inMonth = d.slice(0, 7) === currentMonth;
          const isToday = d === today;
          return (
            <Link
              key={d}
              href={`/dashboard/calendar?view=day&date=${d}`}
              style={{
                display: "block",
                minHeight: 78,
                background: "white",
                border: `1px solid ${isToday ? "#0c1730" : "#e2e2e5"}`,
                borderRadius: 8,
                padding: 6,
                textDecoration: "none",
                opacity: inMonth ? 1 : 0.4,
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: isToday ? 800 : 600, color: isToday ? "#0c1730" : "#666", marginBottom: 4 }}>{Number(d.slice(8, 10))}</div>
              {dayAppts.slice(0, 3).map((a) => (
                <div key={a.id} style={{ fontSize: 10, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: a.appointment_types?.color ?? "#888", marginRight: 3 }} />
                  {formatTime(a.start_at)} {a.patients?.last_name ?? ""}
                </div>
              ))}
              {dayAppts.length > 3 && <div style={{ fontSize: 10, color: "#999" }}>+{dayAppts.length - 3} more</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function isSamePhDay(iso: string, dateStr: string): boolean {
  const ph = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  return ph.toISOString().slice(0, 10) === dateStr;
}
