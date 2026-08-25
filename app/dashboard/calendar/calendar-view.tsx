"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppointmentForm } from "./appointment-form";
import { addDays, formatDayLabel, formatMonthLabel, formatTime, monthGridStart, startOfMonth, startOfWeek, toIsoInstant, todayPh } from "./date-utils";
import { STATUS_GLYPH, STATUS_LABEL, TERMINAL_STATUSES, statusColor } from "./status-constants";
import { GRID_HEIGHT, GridLines, PX_PER_MIN, TimeAxis, layoutEvents, minutesOfDayPh, nowMinutesPh, useScrollToHour, yToTime } from "./time-grid";
import type { DayAvailability } from "./availability";
import { addProviderTimeBlockAction, checkAppointmentConflictsAction, removeProviderTimeBlockAction, saveAppointmentAction, type AppointmentConflict } from "./actions";

type Provider = { id: string; full_name: string; title: string | null };
type ApptType = { id: string; name: string; color: string; default_duration_minutes: number };
type Patient = { id: string; first_name: string; middle_name: string | null; last_name: string; date_of_birth: string; mobile_phone: string | null };
type CancellationReason = { id: string; label: string };
type TimeBlockDisplay = { id: string; provider_id: string; providerName: string; block_date: string; start_time: string; end_time: string; reason: string | null };

type Appointment = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  appointment_type_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
  notes: string | null;
  patients: { first_name: string; last_name: string; mobile_phone: string | null } | null;
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
  availabilityColors,
  availability,
  timeBlocks,
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
  availabilityColors: Record<string, string>;
  availability: Record<string, Record<string, DayAvailability>>;
  timeBlocks: TimeBlockDisplay[];
}) {
  const [formState, setFormState] = useState<{ open: boolean; date: string; time: string; editingId: string | null }>({ open: false, date: anchor, time: "09:00", editingId: null });
  const [hiddenProviderIds, setHiddenProviderIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Drag-to-reschedule: dropping an appointment block on a new time/column
  // never saves immediately — per this app's standing "warn, don't silently
  // act" principle (same one behind the double-booking preflight and the
  // availability-change warnings), the drop is staged as a pending move the
  // user must confirm, showing any conflicts it would create first.
  const [pendingMove, setPendingMove] = useState<{
    apptId: string;
    label: string;
    fromLabel: string;
    toLabel: string;
    newStart: string;
    newEnd: string;
    providerId: string | null;
    conflicts: AppointmentConflict[];
  } | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  async function requestMove(apptId: string, newDate: string, newTime: string, newProviderId: string | null | undefined) {
    const appt = appointments.find((a) => a.id === apptId);
    if (!appt) return;
    if (TERMINAL_STATUSES.has(appt.status)) return; // don't drag a finished/cancelled visit
    const durationMs = Math.max(15 * 60000, new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime());
    const newStart = toIsoInstant(newDate, newTime);
    const newEnd = new Date(new Date(newStart).getTime() + durationMs).toISOString();
    if (newStart === appt.start_at && (newProviderId === undefined || newProviderId === appt.provider_id)) return; // dropped back in place
    const providerId = newProviderId === undefined ? appt.provider_id : newProviderId;
    setMoveError(null);
    let conflicts: AppointmentConflict[] = [];
    try {
      conflicts = await checkAppointmentConflictsAction(providerId, newStart, newEnd, appt.id);
    } catch {
      // if the preflight check itself fails, still let the user decide — the
      // save RPC re-checks server-side regardless
    }
    const who = appt.patients ? `${appt.patients.last_name}, ${appt.patients.first_name}` : "this patient";
    setPendingMove({
      apptId,
      label: who,
      fromLabel: `${formatDayLabel(appt.start_at.slice(0, 10))} · ${formatTime(appt.start_at)}`,
      toLabel: `${formatDayLabel(newDate)} · ${formatTime(newStart)}`,
      newStart,
      newEnd,
      providerId,
      conflicts,
    });
  }

  function cancelMove() {
    setPendingMove(null);
    setMoveError(null);
  }

  function confirmMove() {
    if (!pendingMove) return;
    const appt = appointments.find((a) => a.id === pendingMove.apptId);
    if (!appt) return;
    setMoveBusy(true);
    saveAppointmentAction({
      id: appt.id,
      patientId: appt.patient_id,
      providerId: pendingMove.providerId ?? "",
      appointmentTypeId: appt.appointment_type_id ?? "",
      startAt: pendingMove.newStart,
      endAt: pendingMove.newEnd,
      notes: appt.notes ?? "",
    })
      .then(() => {
        setPendingMove(null);
        setMoveBusy(false);
        router.refresh();
      })
      .catch((e: any) => {
        setMoveError(e.message);
        setMoveBusy(false);
      });
  }

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

  const visibleProviders = providers.filter((p) => !hiddenProviderIds.has(p.id));
  const visibleAppointments = appointments.filter((a) => !a.provider_id || !hiddenProviderIds.has(a.provider_id));

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
    <div style={{ flex: "1 1 640px", minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <NavButton href={prevHref}>‹</NavButton>
          <NavButton href={todayHref}>Today</NavButton>
          <NavButton href={nextHref}>›</NavButton>
          <div style={{ fontWeight: 700, fontSize: 15, marginLeft: 8 }}>{rangeLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid var(--input-border)", borderRadius: 8, overflow: "hidden" }}>
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
          <Link
            href="/dashboard/calendar/patient-booking"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", textDecoration: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 12px" }}
          >
            Patient booking preview
          </Link>
          <button
            onClick={() => openNew(anchor)}
            style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            + New appointment
          </button>
        </div>
      </div>

      {pendingMove && (
        <div style={{ background: "#fff8e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "#5a4600" }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>
              Move {pendingMove.label}: {pendingMove.fromLabel} → {pendingMove.toLabel}?
            </div>
            {pendingMove.conflicts.length > 0 && (
              <div style={{ color: "#a12a2a" }}>
                Conflicts with {pendingMove.conflicts.length} other appointment{pendingMove.conflicts.length > 1 ? "s" : ""} for this provider at that time.
              </div>
            )}
            {moveError && <div style={{ color: "crimson" }}>{moveError}</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cancelMove} disabled={moveBusy} style={{ background: "var(--card-bg)", border: "1px solid var(--input-border)", borderRadius: 7, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={confirmMove}
              disabled={moveBusy}
              style={{
                background: pendingMove.conflicts.length > 0 ? "#a12a2a" : "#0c1730",
                color: pendingMove.conflicts.length > 0 ? "white" : "#e6c66b",
                border: "none",
                borderRadius: 7,
                padding: "7px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {moveBusy ? "Moving…" : pendingMove.conflicts.length > 0 ? "Move anyway" : "Confirm move"}
            </button>
          </div>
        </div>
      )}

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

      {view === "day" && (
        <DayView
          date={anchor}
          providers={visibleProviders}
          appointments={visibleAppointments}
          statusColors={statusColors}
          availabilityColors={availabilityColors}
          availability={availability}
          onOpen={openEdit}
          onAddAt={openNew}
          onMove={requestMove}
        />
      )}
      {view === "week" && (
        <WeekView weekStart={startOfWeek(anchor)} appointments={visibleAppointments} statusColors={statusColors} onOpen={openEdit} onAddAt={openNew} onMove={requestMove} />
      )}
      {view === "month" && <MonthView anchor={anchor} appointments={visibleAppointments} />}
    </div>

    <CalendarSidebar
      anchor={anchor}
      view={view}
      providers={providers}
      availabilityColors={availabilityColors}
      hiddenProviderIds={hiddenProviderIds}
      onToggleProvider={(id) =>
        setHiddenProviderIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        })
      }
      timeBlocks={timeBlocks}
    />
    </div>
  );
}

// Right-side sidebar: a mini month calendar for quick date-jumping, a
// provider show/hide filter, and a blocked-time (day off / lunch / holiday)
// manager. Put on the right rather than the left (per user direction) —
// keeps the grid itself, the thing actually being worked in, on the left
// where reading starts.
function CalendarSidebar({
  anchor,
  view,
  providers,
  hiddenProviderIds,
  onToggleProvider,
  timeBlocks,
  availabilityColors,
}: {
  anchor: string;
  view: "day" | "week" | "month";
  providers: Provider[];
  hiddenProviderIds: Set<string>;
  onToggleProvider: (id: string) => void;
  timeBlocks: TimeBlockDisplay[];
  availabilityColors: Record<string, string>;
}) {
  const [miniMonth, setMiniMonth] = useState(anchor.slice(0, 7) + "-01");
  const [blockFormOpen, setBlockFormOpen] = useState(false);

  const gridStart = monthGridStart(miniMonth);
  const miniDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = todayPh();

  return (
    <div style={{ flex: "0 0 260px", width: 260, display: "grid", gap: 14 }}>
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => setMiniMonth(addDays(startOfMonth(miniMonth), -1).slice(0, 7) + "-01")} style={miniNavBtn}>
            ‹
          </button>
          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{formatMonthLabel(miniMonth)}</div>
          <button onClick={() => setMiniMonth(addDays(startOfMonth(miniMonth), 32).slice(0, 7) + "-01")} style={miniNavBtn}>
            ›
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} style={{ fontSize: 9.5, color: "#aaa", textAlign: "center" }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {miniDays.map((d) => {
            const inMonth = d.slice(0, 7) === miniMonth.slice(0, 7);
            const isToday = d === today;
            const isSelected = d === anchor;
            return (
              <Link
                key={d}
                href={`/dashboard/calendar?view=${view === "month" ? "day" : view}&date=${d}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 24,
                  borderRadius: 6,
                  fontSize: 11,
                  textDecoration: "none",
                  color: isSelected ? "white" : isToday ? "#0c1730" : inMonth ? "#333" : "#ccc",
                  background: isSelected ? "#0c1730" : isToday ? "#f0f4ff" : "transparent",
                  fontWeight: isToday || isSelected ? 700 : 400,
                }}
              >
                {Number(d.slice(8, 10))}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Providers</div>
        {providers.length === 0 ? (
          <p style={{ color: "#aaa", fontSize: 11.5 }}>None yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {providers.map((p) => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={!hiddenProviderIds.has(p.id)} onChange={() => onToggleProvider(p.id)} />
                {p.title ? `${p.title} ` : ""}
                {p.full_name}
              </label>
            ))}
          </div>
        )}
      </div>

      {view === "day" && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12, display: "flex", gap: 16, fontSize: 11.5, color: "#666" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: availabilityColors.available ?? "#e5e7eb", border: "1px solid #d8d8db", flexShrink: 0 }} />
            Available
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: availabilityColors.unavailable ?? "#4b5563", flexShrink: 0 }} />
            Unavailable / blocked
          </div>
        </div>
      )}

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5 }}>Blocked time</div>
          <button onClick={() => setBlockFormOpen((v) => !v)} style={{ background: "none", border: "none", color: "var(--text-heading)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
            {blockFormOpen ? "Cancel" : "+ Block"}
          </button>
        </div>

        {blockFormOpen && <BlockTimeForm providers={providers} defaultDate={anchor} onDone={() => setBlockFormOpen(false)} />}

        {timeBlocks.length === 0 ? (
          <p style={{ color: "#aaa", fontSize: 11.5 }}>No blocks in this range.</p>
        ) : (
          <div style={{ display: "grid", gap: 6, marginTop: blockFormOpen ? 10 : 0 }}>
            {timeBlocks.map((b) => (
              <BlockTimeRow key={b.id} block={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const miniNavBtn: React.CSSProperties = { background: "none", border: "1px solid var(--input-border)", borderRadius: 6, width: 22, height: 22, cursor: "pointer", fontSize: 12, color: "#555" };

function BlockTimeRow({ block }: { block: TimeBlockDisplay }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <div style={{ fontSize: 11, border: "1px solid #eee", borderRadius: 6, padding: "6px 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div>
          <div style={{ fontWeight: 700, color: "#333" }}>{block.providerName}</div>
          <div style={{ color: "#888" }}>
            {block.block_date.slice(5)} · {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}
          </div>
          {block.reason && <div style={{ color: "#aaa" }}>{block.reason}</div>}
        </div>
        <button
          onClick={() => {
            setPending(true);
            removeProviderTimeBlockAction(block.id)
              .then(() => router.refresh())
              .catch(() => setPending(false));
          }}
          disabled={pending}
          style={{ background: "none", border: "none", color: "#a12a2a", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
          title="Remove block"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function BlockTimeForm({ providers, defaultDate, onDone }: { providers: Provider[]; defaultDate: string; onDone: () => void }) {
  const router = useRouter();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!providerId) return setError("Select a provider.");
    setError(null);
    setPending(true);
    addProviderTimeBlockAction({ providerId, blockDate: date, startTime: start, endTime: end, reason })
      .then(() => {
        router.refresh();
        onDone();
      })
      .catch((e: any) => {
        setError(e.message);
        setPending(false);
      });
  }

  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 10, fontSize: 11.5 }}>
      <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={miniFieldStyle}>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={miniFieldStyle} />
      <div style={{ display: "flex", gap: 6 }}>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...miniFieldStyle, flex: 1 }} />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...miniFieldStyle, flex: 1 }} />
      </div>
      <input placeholder="Reason (e.g. Lunch, Leave)" value={reason} onChange={(e) => setReason(e.target.value)} style={miniFieldStyle} />
      {error && <div style={{ color: "crimson" }}>{error}</div>}
      <button onClick={submit} disabled={pending} style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer" }}>
        {pending ? "Saving…" : "Add block"}
      </button>
    </div>
  );
}

const miniFieldStyle: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 6, padding: "5px 7px", fontSize: 11.5, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

function NavButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 34, height: 32, padding: "0 10px", border: "1px solid var(--input-border)", borderRadius: 8, textDecoration: "none", color: "#333", fontSize: 12.5, fontWeight: 600, background: "var(--card-bg)" }}
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
  const draggable = !TERMINAL_STATUSES.has(a.status);
  const who = a.patients ? `${a.patients.last_name}, ${a.patients.first_name}` : "Unknown patient";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      draggable={draggable}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("text/plain", a.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      title={`${formatTime(a.start_at)}–${formatTime(a.end_at)} · ${who}${a.appointment_types ? ` · ${a.appointment_types.name}` : ""} · ${STATUS_LABEL[a.status] ?? a.status}${draggable ? " · drag to reschedule" : ""}`}
      style={{
        position: "absolute",
        top,
        height,
        left: `calc(${(col / colCount) * 100}% + 2px)`,
        width: `calc(${100 / colCount}% - 4px)`,
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderLeft: `4px solid ${typeColor}`,
        borderRadius: 5,
        padding: "2px 5px",
        fontSize: 10.5,
        lineHeight: 1.25,
        overflow: "hidden",
        cursor: draggable ? "grab" : "pointer",
        opacity: isMuted ? 0.55 : 1,
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        zIndex: 2,
      }}
    >
      <div style={{ fontWeight: 700, color: "var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {formatTime(a.start_at)} {who}
      </div>
      {height > 30 && (a.appointment_types || a.patients?.mobile_phone) && (
        <div style={{ color: "#777", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.appointment_types?.name}
          {a.appointment_types && a.patients?.mobile_phone ? " · " : ""}
          {a.patients?.mobile_phone ?? ""}
        </div>
      )}
      {/* Status is shown via glyph + text, not color alone, so it reads for colorblind users too. */}
      <div style={{ color: sColor, fontWeight: 700, whiteSpace: "nowrap" }}>
        {STATUS_GLYPH[a.status] ?? ""}
        {height > 42 ? ` ${STATUS_LABEL[a.status] ?? a.status}` : ""}
      </div>
    </div>
  );
}

// Background shading behind a provider's grid column — light where they're
// working, dark outside that (and for one-off blocked ranges layered back
// on top of the light band, e.g. a lunch break). Only rendered once a
// provider has actual working hours configured (see availability.ts) —
// unconfigured providers get no shading at all rather than a false "fully
// unavailable" read. A provider's configured ranges are the ONLY source of
// "available" — everything outside them (and any block layered on top) is
// unavailable by default, so this needs no separate "is this slot open"
// flag anywhere else; it just reflects what's already configured.
//
// Opacities are tuned so the two states are unmistakably different at a
// glance (per explicit user feedback that the previous low-opacity wash
// made available and blocked slots look almost identical) rather than for
// subtlety — available reads as a clean light tint, unavailable/blocked as
// a clearly darker one.
function AvailabilityShading({ avail, availabilityColors }: { avail: DayAvailability | undefined; availabilityColors: Record<string, string> }) {
  if (!avail || !avail.configured) return null;
  const availColor = availabilityColors.available ?? "#e5e7eb";
  const unavailColor = availabilityColors.unavailable ?? "#4b5563";
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: GRID_HEIGHT, background: unavailColor, opacity: 0.6, zIndex: 0, pointerEvents: "none" }} />
      {avail.ranges.map((r, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: r.startMin * PX_PER_MIN,
            left: 0,
            right: 0,
            height: (r.endMin - r.startMin) * PX_PER_MIN,
            background: availColor,
            opacity: 0.85,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
      ))}
      {avail.blocks.map((b) => (
        <div
          key={b.id}
          title={b.reason ?? "Blocked"}
          style={{
            position: "absolute",
            top: b.startMin * PX_PER_MIN,
            left: 0,
            right: 0,
            height: Math.max(4, (b.endMin - b.startMin) * PX_PER_MIN),
            background: unavailColor,
            opacity: 0.6,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

// One scrollable 24h column (a provider's day, or a day-of-week) — click
// empty space to add an appointment at that time, overlapping appointments
// split into side-by-side sub-columns via layoutEvents.
function GridColumn({
  appointments,
  statusColors,
  availabilityColors,
  avail,
  date,
  providerId,
  onOpen,
  onEmptyClick,
  onDropAppt,
}: {
  appointments: Appointment[];
  statusColors: Record<string, string>;
  availabilityColors?: Record<string, string>;
  avail?: DayAvailability;
  // date this column represents, and which provider a drop here should be
  // attributed to — undefined providerId means "keep the appointment's
  // existing provider" (week view, one column per day, provider unchanged);
  // null means "explicitly unassigned" (the Day view's Unassigned column).
  date?: string;
  providerId?: string | null;
  onOpen: (a: Appointment) => void;
  onEmptyClick: (time: string) => void;
  onDropAppt?: (apptId: string, date: string, time: string, providerId: string | null | undefined) => void;
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
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onEmptyClick(yToTime(e.clientY - rect.top));
      }}
      onDragOver={(e) => {
        if (!onDropAppt || !date) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!onDropAppt || !date) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const apptId = e.dataTransfer.getData("text/plain");
        if (!apptId) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onDropAppt(apptId, date, yToTime(e.clientY - rect.top), providerId);
      }}
      style={{ position: "relative", height: GRID_HEIGHT, cursor: "pointer", outline: dragOver ? "2px dashed #0c1730" : "none", outlineOffset: -2 }}
    >
      {availabilityColors && <AvailabilityShading avail={avail} availabilityColors={availabilityColors} />}
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
  availabilityColors,
  availability,
  onOpen,
  onAddAt,
  onMove,
}: {
  date: string;
  providers: Provider[];
  appointments: Appointment[];
  statusColors: Record<string, string>;
  availabilityColors: Record<string, string>;
  availability: Record<string, Record<string, DayAvailability>>;
  onOpen: (a: Appointment) => void;
  onAddAt: (date: string, time: string) => void;
  onMove: (apptId: string, date: string, time: string, providerId: string | null | undefined) => void;
}) {
  const scrollRef = useScrollToHour<HTMLDivElement>();
  const isToday = date === todayPh();
  const unassigned = appointments.filter((a) => !a.provider_id);
  const showUnassignedCol = providers.length === 0 || unassigned.length > 0;
  const colWidth = 160;
  const minWidth = 52 + Math.max(1, providers.length + (showUnassignedCol ? 1 : 0)) * colWidth;

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, overflow: "auto" }}>
      <div style={{ minWidth }}>
        <div style={{ display: "flex", borderBottom: "1px solid #e2e2e5", position: "sticky", top: 0, background: "var(--card-bg)", zIndex: 5 }}>
          <div style={{ width: 52, flexShrink: 0 }} />
          {providers.map((p) => (
            <div key={p.id} style={{ flex: 1, minWidth: colWidth, padding: "8px 10px", fontWeight: 700, fontSize: 12.5, color: "var(--text-heading)", borderLeft: "1px solid #eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
              <GridColumn
                appointments={appointments.filter((a) => a.provider_id === p.id)}
                statusColors={statusColors}
                availabilityColors={availabilityColors}
                avail={availability[p.id]?.[date]}
                date={date}
                providerId={p.id}
                onOpen={onOpen}
                onEmptyClick={(t) => onAddAt(date, t)}
                onDropAppt={onMove}
              />
            </div>
          ))}
          {showUnassignedCol && (
            <div style={{ flex: 1, minWidth: colWidth, borderLeft: "1px solid #eee" }}>
              <GridColumn
                appointments={providers.length === 0 ? appointments : unassigned}
                statusColors={statusColors}
                date={date}
                providerId={providers.length === 0 ? undefined : null}
                onOpen={onOpen}
                onEmptyClick={(t) => onAddAt(date, t)}
                onDropAppt={onMove}
              />
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
  onMove,
}: {
  weekStart: string;
  appointments: Appointment[];
  statusColors: Record<string, string>;
  onOpen: (a: Appointment) => void;
  onAddAt: (date: string, time: string) => void;
  onMove: (apptId: string, date: string, time: string, providerId: string | null | undefined) => void;
}) {
  const scrollRef = useScrollToHour<HTMLDivElement>();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayPh();
  const todayIndex = days.indexOf(today);
  const colWidth = 130;
  const minWidth = 52 + 7 * colWidth;

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, overflow: "auto" }}>
      <div style={{ minWidth }}>
        <div style={{ display: "flex", borderBottom: "1px solid #e2e2e5", position: "sticky", top: 0, background: "var(--card-bg)", zIndex: 5 }}>
          <div style={{ width: 52, flexShrink: 0 }} />
          {days.map((d) => {
            const isToday = d === today;
            return (
              <div key={d} style={{ flex: 1, minWidth: colWidth, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderLeft: "1px solid #eee", background: isToday ? "#f0f4ff" : "white" }}>
                <span style={{ fontWeight: 700, fontSize: 12.5, color: isToday ? "#0c1730" : "#555" }}>{formatDayLabel(d)}</span>
                <button onClick={() => onAddAt(d, "09:00")} title="Add appointment" style={{ background: "none", border: "none", color: "var(--text-heading)", cursor: "pointer", fontSize: 15, fontWeight: 700, lineHeight: 1 }}>
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
              <GridColumn
                appointments={appointments.filter((a) => isSamePhDay(a.start_at, d))}
                statusColors={statusColors}
                date={d}
                onOpen={onOpen}
                onEmptyClick={(t) => onAddAt(d, t)}
                onDropAppt={onMove}
              />
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
                background: "var(--card-bg)",
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
