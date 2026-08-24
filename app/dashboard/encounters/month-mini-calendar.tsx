"use client";

import { useRouter } from "next/navigation";
import { addDays, monthGridStart, formatMonthLabel, startOfMonth, todayPh } from "../calendar/date-utils";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

// Month calendar with a dot indicator on dates that have encounters (spec
// §2) — browsing the month has its own prev/next, independent of the main
// date view, so scanning nearby months never disturbs what's selected.
// Clicking a day both selects it and recenters the mini-calendar on it.
export function MonthMiniCalendar({ monthAnchor, selectedDate, encounterDates }: { monthAnchor: string; selectedDate: string; encounterDates: string[] }) {
  const router = useRouter();
  const today = todayPh();
  const monthFirst = monthAnchor.slice(0, 7) + "-01";
  const gridStart = monthGridStart(monthFirst);
  const hasEncounter = new Set(encounterDates);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const currentMonth = monthFirst.slice(0, 7);

  function goMonth(next: string) {
    const params = new URLSearchParams();
    params.set("date", selectedDate);
    params.set("month", next);
    router.push(`/dashboard/encounters?${params.toString()}`);
  }

  function pickDay(d: string) {
    const params = new URLSearchParams();
    params.set("date", d);
    params.set("month", startOfMonth(d));
    router.push(`/dashboard/encounters?${params.toString()}`);
  }

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => goMonth(startOfMonth(addDays(monthFirst, -1)))} style={ARROW_BTN} aria-label="Previous month">‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-heading)" }}>{formatMonthLabel(monthFirst)}</span>
        <button onClick={() => goMonth(startOfMonth(addDays(monthFirst, 32)))} style={ARROW_BTN} aria-label="Next month">›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#999", padding: "2px 0" }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === currentMonth;
          const isSelected = d === selectedDate;
          const isToday = d === today;
          const hasDot = hasEncounter.has(d);
          return (
            <button
              key={d}
              onClick={() => pickDay(d)}
              title={hasDot ? "Has encounters" : undefined}
              style={{
                position: "relative",
                border: isToday ? "1px solid #0c1730" : "1px solid transparent",
                borderRadius: 6,
                background: isSelected ? "#0c1730" : "transparent",
                color: isSelected ? "#e6c66b" : inMonth ? "#1a1a1a" : "#ccc",
                fontSize: 11.5,
                padding: "5px 0",
                cursor: "pointer",
                fontWeight: isSelected || isToday ? 700 : 400,
              }}
            >
              {Number(d.slice(8, 10))}
              {hasDot && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: isSelected ? "#e6c66b" : "#4a86e8",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 10.5, color: "#888" }}>
        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4a86e8", display: "inline-block" }} />
        <span>= has encounters (also shown as “Has encounters” on hover/focus)</span>
      </div>
    </div>
  );
}

const ARROW_BTN: React.CSSProperties = { background: "none", border: "1px solid var(--input-border)", borderRadius: 6, width: 24, height: 24, cursor: "pointer", fontSize: 13, color: "var(--text-heading)", lineHeight: 1 };
