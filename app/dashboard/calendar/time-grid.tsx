"use client";

import { useEffect, useRef } from "react";

// Shared building blocks for a Google Calendar / ECW-style hourly grid:
// a scrollable 24-hour column with absolutely-positioned, overlap-packed
// event blocks. Used by both Day view (one column per provider) and Week
// view (one column per day, providers merged) in calendar-view.tsx.

export const PX_PER_MIN = 1; // 60px per hour
export const GRID_HEIGHT = 24 * 60 * PX_PER_MIN;
export const SCROLL_TO_HOUR = 7; // clinics open ~7-8am — start scrolled there, like Google Calendar's default view

export function minutesOfDayPh(iso: string): number {
  const ph = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  return ph.getUTCHours() * 60 + ph.getUTCMinutes();
}

export function nowMinutesPh(): number {
  return minutesOfDayPh(new Date().toISOString());
}

// Classic calendar event-layout: overlapping events split into side-by-side
// sub-columns (same idea Google Calendar/ECW use) instead of stacking or
// covering each other.
export function layoutEvents<T extends { id: string; startMin: number; endMin: number }>(
  events: T[]
): { event: T; col: number; colCount: number }[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const placements: { event: T; col: number; colCount: number }[] = [];
  let clusterEvents: { event: T; col: number }[] = [];
  let clusterCols: number[] = [];
  let clusterEnd = -Infinity;

  function flush() {
    if (!clusterEvents.length) return;
    const colCount = clusterCols.length;
    for (const p of clusterEvents) placements.push({ ...p, colCount });
    clusterEvents = [];
    clusterCols = [];
  }

  for (const ev of sorted) {
    if (clusterCols.length && ev.startMin >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let placedCol = -1;
    for (let c = 0; c < clusterCols.length; c++) {
      if (clusterCols[c] <= ev.startMin) {
        placedCol = c;
        break;
      }
    }
    if (placedCol === -1) {
      placedCol = clusterCols.length;
      clusterCols.push(ev.endMin);
    } else {
      clusterCols[placedCol] = ev.endMin;
    }
    clusterEvents.push({ event: ev, col: placedCol });
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  flush();
  return placements;
}

function hourLabel(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

export function TimeAxis() {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div style={{ position: "relative", width: 52, flexShrink: 0, height: GRID_HEIGHT }}>
      {hours.map((h) => (
        <div key={h} style={{ position: "absolute", top: h * 60 * PX_PER_MIN - 6, right: 8, fontSize: 10.5, color: "#999", whiteSpace: "nowrap" }}>
          {hourLabel(h)}
        </div>
      ))}
    </div>
  );
}

export function GridLines() {
  const hours = Array.from({ length: 25 }, (_, i) => i);
  return (
    <>
      {hours.map((h) => (
        <div key={h} style={{ position: "absolute", top: h * 60 * PX_PER_MIN, left: 0, right: 0, borderTop: "1px solid #eee", pointerEvents: "none" }} />
      ))}
    </>
  );
}

export function NowLine({ show }: { show: boolean }) {
  if (!show) return null;
  const top = nowMinutesPh() * PX_PER_MIN;
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, zIndex: 4, pointerEvents: "none", display: "flex", alignItems: "center" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e53935", marginLeft: -4 }} />
      <div style={{ flex: 1, height: 2, background: "#e53935" }} />
    </div>
  );
}

export function useScrollToHour<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = SCROLL_TO_HOUR * 60 * PX_PER_MIN - 30;
  }, []);
  return ref;
}

// Turn a click's Y offset within a grid column into an HH:mm PH time,
// snapped to the nearest 15 minutes — powers "click empty space to add".
export function yToTime(offsetY: number): string {
  const totalMin = Math.max(0, Math.min(24 * 60 - 1, Math.round(offsetY / PX_PER_MIN / 15) * 15));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
