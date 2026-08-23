"use client";

import { useState } from "react";
import Link from "next/link";
import { AppointmentForm } from "./appointment-form";
import { addDays, formatDayLabel, formatMonthLabel, formatTime, monthGridStart, startOfMonth, startOfWeek, todayPh } from "./date-utils";
import { STATUS_GLYPH, STATUS_LABEL, statusColor } from "./status-constants";
import { GRID_HEIGHT, GridLines, PX_PER_MIN, TimeAxis, layoutEvents, minutesOfDayPh, nowMinutesPh, useScrollToHour, yToTime } from "./time-grid";

type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string; color: string; default_duration_minutes: number };
type Patient = { id: string; first_name: string; middle_name: string | null; last_name: string; mobile_phone: string | null };
type CancellationReason = { id: string; label: string };

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

export function CalendarView({
  view,
  anchor,
  providers,
  appointmentTypes,
  patients,
  appointments,
  statusColors,
  allowDoubleBooking,
  cancellationReasons,
}: {
  view: "day" | "week" | "month";
  anchor: string;
  providers: Provider[];
  appointmentTypes: ApptType[];
  patients: Patient[];
  appointments: Appointment[];
  statusColors: Record<string, string>;
  allowDoubleBooking: boolean;
  cancellationReasons: CancellationReason[];
}) {
  const [formState, setFormState] = useState<{ open: boolean; date: string; time: string; editingId: string | null }>({ open: false, date: anchor, time: "09:00", editingId: null });

  function openNew(date: string, time: string = "09:00") {
    setFormState({ open: true, date, time, editingId: null });
  }
  function openEdit(a: Appointment) {
    setFormState({ open: true, date: anchor, time: "09:00", editingId: a.id });
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
          defaultTime={formState.time}
          editing={editingForForm}
          providers={providers}
          appointmentTypes={appointmentTypes}
          patients={patients}
          allowDoubleBooking={allowDoubleBooking}
          cancellationReasons={cancellationReasons}
          onClose={close}
        />
      )}

      {providers.length === 0 && (
        <div style={{ background: "#fff6e6", border: "1px solid #f0d998", borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13, color: "#8a6100" }}>
          No active doctors on your team yet — add one under Settings → Users before booking appointments.
        </div>
      )}

      {view === "day" && <DayView date={anchor} providers={providers} appointments={appointments} statusColors={statusColors} onOpen={openEdit} onAddAt={openNew} />}
      {view === "week" && <WeekView weekStart={startOfWeek(anchor)} appointments={appointments} statusColors={statusColors} onOpen={openEdit} onAddAt={openNew} />}
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

// One absolutely-positioned appointment block inside a time-grid column
// (Google Calendar / ECW style) — replaces the old flat agenda-list chip.
function GridEventBlock({
  a,
  col,
  colCount,
  statusColors,
  onClick,
}: {
  a: Appointment;
  col: number;
  colCount: number;
  statusColors: Record<string, string>;
  onClick: () => void;
}) {
  const startMin = minutesOfDayPh(a.start_at);
  let endMin = minutesOfDayPh(a.end_at);
  if (endMin <= startMin) endMin = startMin + 15;
  const top = startMin * PX_PER_MIN;
  const height = Math.max(16, (endMin - startMin) * PX_PER_MIN);
  const typeColor = a.appointment_types?.color ?? "#888";
  const sColor = statusColor(statusColors, a.status);
  const isMuted = a.status === "cancelled" || a.status === "no_show" || a.status === "late_cancellation";
  const who = a.patients ? `${a.patients.last_name}, ${a.patients.first_name}` : "Unknown patient";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${formatTime(a.start_at)}–${formatTime(a.end_at)} · ${who}${a.appointment_types ? ` · ${a.appointment_types.name}` : ""} · ${STATUS_LABEL[a.status] ?? a.status}`}
      style={{
        position: "absolute",
        top,
        height,
        left: `calc(${(col / colCount) * 100}% + 2px)`,
        width: `calc(${100 / colCount}% - 4px)`,
        background: "white",
        border: "1px solid #e2e2e5",
        borderLeft: `4px solid ${typeColor}`,
        borderRadius: 5,
        padding: "2px 5px",
        fontSize: 10.5,
        lineHeight: 1.25,
        overflow: "hidden",
        cursor: "pointer",
        opacity: isMuted ? 0.55 : 1,
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        zIndex: 2,
      }}
    >
      <div style={{ fontWeight: 700, color: "#0c1730", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {formatTime(a.start_at)} {who}
      </div>
      {height > 30 && a.appointment_types && (
        <div style={{ color: "#777", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.appointment_types.name}</div>
      )}
      {/* Status is shown via glyph + text, not color alone, so it reads for colorblind users too. */}
      <div style={{ color: sColor, fontWeight: 700, whiteSpace: "nowrap" }}>
        {STATUS_GLYPH[a.status] ?? ""}
        {height > 42 ? ` ${STATUS_LABEL[a.status] ?? a.status}` : ""}
      </div>
    </div>
  );
}

// One scrollable 24h column (a provider's day, or a day-of-week) — click
// empty space to add an appointment at that time, overlapping appointments
// split into side-by-side sub-columns via layoutEvents.
function GridColumn({
  appointments,
  statusColors,
  onOpen,
  onEmptyClick,
}: {
  appointments: Appointment[];
  statusColors: Record<string, string>;
  onOpen: (a: Appointment) => void;
  onEmptyClick: (time: string) => void;
}) {
  const byId = new Map(appointments.map((a) => [a.id, a]));
  const laidOut = layoutEvents(
    appointments.map((a) => {
      const startMin = minutesOfDayPh(a.start_at);
      let endMin = minutesOfDayPh(a.end_at);
      if (endMin <= startMin) endMin = startMin + 15;
      return { id: a.id, startMin, endMin };
    })
  );

  return (
    <div
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onEmptyClick(yToTime(e.clientY - rect.top));
      }}
      style={{ position: "relative", height: GRID_HEIGHT, cursor: "pointer" }}
    >
      <GridLines />
      {laidOut.map(({ event, col, colCount }) => {
        const a = byId.get(event.id)!;
        return <GridEventBlock key={a.id} a={a} col={col} colCount={colCount} statusColors={statusColors} onClick={() => onOpen(a)} />;
      })}
    </div>
  );
}

function NowLineOverlay() {
  return (
    <div style={{ position: "absolute", top: nowMinutesPh() * PX_PER_MIN, left: 52, right: 0, zIndex: 4, pointerEvents: "none", display: "flex", alignItems: "center" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e53935", marginLeft: -4 }} />
      <div style={{ flex: 1, height: 2, background: "#e53935" }} />
    </div>
  );
}

function DayView({
  date,
  providers,
  appointments,
  statusColors,
  onOpen,
  onAddAt,
}: {
  date: string;
  providers: Provider[];
  appointments: Appointment[];
  statusColors: Record<string, string>;
  onOpen: (a: Appointment) => void;
  onAddAt: (date: string, time: string) => void;
}) {
  const scrollRef = useScrollToHour<HTMLDivElement>();
  const isToday = date === todayPh();
  const unassigned = appointments.filter((a) => !a.provider_id);
  const showUnassignedCol = providers.length === 0 || unassigned.length > 0;
  const colWidth = 160;
  const minWidth = 52 + Math.max(1, providers.length + (showUnassignedCol ? 1 : 0)) * colWidth;

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, overflow: "auto" }}>
      <div style={{ minWidth }}>
        <div style={{ display: "flex", borderBottom: "1px solid #e2e2e5", position: "sticky", top: 0, background: "white", zIndex: 5 }}>
          <div style={{ width: 52, flexShrink: 0 }} />
          {providers.map((p) => (
            <div key={p.id} style={{ flex: 1, minWidth: colWidth, padding: "8px 10px", fontWeight: 700, fontSize: 12.5, color: "#0c1730", borderLeft: "1px solid #eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.title ? `${p.title} ` : ""}
              {p.full_name}
            </div>
          ))}
          {showUnassignedCol && (
            <div style={{ flex: 1, minWidth: colWidth, padding: "8px 10px", fontWeight: 700, fontSize: 12.5, color: "#666", borderLeft: "1px solid #eee" }}>
              {providers.length === 0 ? "All appointments" : "Unassigned"}
            </div>
          )}
        </div>

        <div ref={scrollRef} style={{ display: "flex", position: "relative", maxHeight: 640, overflowY: "auto" }}>
          <TimeAxis />
          {providers.map((p) => (
            <div key={p.id} style={{ flex: 1, minWidth: colWidth, borderLeft: "1px solid #eee" }}>
              <GridColumn appointments={appointments.filter((a) => a.provider_id === p.id)} statusColors={statusColors} onOpen={onOpen} onEmptyClick={(t) => onAddAt(date, t)} />
            </div>
          ))}
          {showUnassignedCol && (
            <div style={{ flex: 1, minWidth: colWidth, borderLeft: "1px solid #eee" }}>
              <GridColumn appointments={providers.length === 0 ? appointments : unassigned} statusColors={statusColors} onOpen={onOpen} onEmptyClick={(t) => onAddAt(date, t)} />
            </div>
          )}
          {isToday && <NowLineOverlay />}
        </div>
      </div>
    </div>
  );
}

function WeekView({
  weekStart,
  appointments,
  statusColors,
  onOpen,
  onAddAt,
}: {
  weekStart: string;
  appointments: Appointment[];
  statusColors: Record<string, string>;
  onOpen: (a: Appointment) => void;
  onAddAt: (date: string, time: string) => void;
}) {
  const scrollRef = useScrollToHour<HTMLDivElement>();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayPh();
  const todayIndex = days.indexOf(today);
  const colWidth = 130;
  const minWidth = 52 + 7 * colWidth;

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, overflow: "auto" }}>
      <div style={{ minWidth }}>
        <div style={{ display: "flex", borderBottom: "1px solid #e2e2e5", position: "sticky", top: 0, background: "white", zIndex: 5 }}>
          <div style={{ width: 52, flexShrink: 0 }} />
          {days.map((d) => {
            const isToday = d === today;
            return (
              <div key={d} style={{ flex: 1, minWidth: colWidth, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderLeft: "1px solid #eee", background: isToday ? "#f0f4ff" : "white" }}>
                <span style={{ fontWeight: 700, fontSize: 12.5, color: isToday ? "#0c1730" : "#555" }}>{formatDayLabel(d)}</span>
                <button onClick={() => onAddAt(d, "09:00")} title="Add appointment" style={{ background: "none", border: "none", color: "#0c1730", cursor: "pointer", fontSize: 15, fontWeight: 700, lineHeight: 1 }}>
                  +
                </button>
              </div>
            );
          })}
        </div>

        <div ref={scrollRef} style={{ display: "flex", position: "relative", maxHeight: 640, overflowY: "auto" }}>
          <TimeAxis />
          {days.map((d) => (
            <div key={d} style={{ flex: 1, minWidth: colWidth, borderLeft: "1px solid #eee" }}>
              <GridColumn appointments={appointments.filter((a) => isSamePhDay(a.start_at, d))} statusColors={statusColors} onOpen={onOpen} onEmptyClick={(t) => onAddAt(d, t)} />
            </div>
          ))}
          {todayIndex >= 0 && <NowLineOverlay />}
        </div>
      </div>
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
