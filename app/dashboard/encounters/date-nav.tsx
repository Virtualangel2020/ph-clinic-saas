"use client";

import { useRouter } from "next/navigation";
import { addDays, formatDayLabel, todayPh } from "../calendar/date-utils";

// Prominent date navigator (spec §1, §19) — date is the primary organizing
// principle for the Encounters module. Picking a new date always drops any
// active Search Encounters mode/filters, since date-view and search-view
// are meant to stay two clear, separate paths (spec §22).
export function DateNav({ date }: { date: string }) {
  const router = useRouter();
  const today = todayPh();

  function go(nextDate: string) {
    const params = new URLSearchParams();
    params.set("date", nextDate);
    router.push(`/dashboard/encounters?${params.toString()}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => go(addDays(date, -1))} style={NAV_BTN} aria-label="Previous date">
          ← Previous Date
        </button>
        <button onClick={() => go(today)} style={{ ...NAV_BTN, fontWeight: date === today ? 700 : 600 }}>
          Today
        </button>
        <button onClick={() => go(addDays(date, 1))} style={NAV_BTN} aria-label="Next date">
          Next Date →
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-heading)" }}>{formatDayLabel(date)}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(e.target.value)}
          style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "6px 8px", fontSize: 12.5, fontFamily: "inherit" }}
          aria-label="Select date"
        />
      </div>
    </div>
  );
}

const NAV_BTN: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--input-border)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--text-heading)" };
