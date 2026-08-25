import { todayPh, addDays, startOfWeek, startOfMonth, formatDayLabel } from "../calendar/date-utils";

// Resolves the Financial dashboard's date-range controls (§22 of the
// Financial module spec: Today / This Week / This Month / Last Month /
// Custom, plus a Month picker and a Year picker) into a single
// [from, toExclusive) pair of PH calendar dates. Every query in
// financials/page.tsx filters against this one pair, so "This Month" and
// "Custom Aug 1 – Aug 24" behave identically once resolved — there's no
// separate code path per preset past this function.
export type FinancialRangeKey = "today" | "week" | "month" | "last_month" | "year" | "custom";

export type FinancialRange = {
  key: FinancialRangeKey;
  from: string; // YYYY-MM-DD, inclusive
  toExclusive: string; // YYYY-MM-DD, exclusive upper bound
  label: string;
};

function firstOfNextMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

export function resolveFinancialRange(searchParams: {
  range?: string;
  month?: string; // YYYY-MM
  year?: string; // YYYY
  from?: string;
  to?: string;
}): FinancialRange {
  const today = todayPh();

  // Custom explicit From/To wins over everything else.
  if (searchParams.from && searchParams.to) {
    return {
      key: "custom",
      from: searchParams.from,
      toExclusive: addDays(searchParams.to, 1),
      label: `${formatDayLabel(searchParams.from)} – ${formatDayLabel(searchParams.to)}`,
    };
  }

  if (searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month)) {
    const from = `${searchParams.month}-01`;
    return { key: "custom", from, toExclusive: firstOfNextMonth(from), label: formatMonthLabel(searchParams.month) };
  }

  if (searchParams.year && /^\d{4}$/.test(searchParams.year)) {
    const from = `${searchParams.year}-01-01`;
    return { key: "year", from, toExclusive: `${Number(searchParams.year) + 1}-01-01`, label: searchParams.year };
  }

  switch (searchParams.range) {
    case "today":
      return { key: "today", from: today, toExclusive: addDays(today, 1), label: "Today" };
    case "week": {
      const from = startOfWeek(today);
      return { key: "week", from, toExclusive: addDays(today, 1), label: `This Week (${formatDayLabel(from)} – ${formatDayLabel(today)})` };
    }
    case "last_month": {
      const from = firstOfPrevMonth(startOfMonth(today));
      return { key: "last_month", from, toExclusive: startOfMonth(today), label: formatMonthLabel(from.slice(0, 7)) };
    }
    case "month":
    default: {
      const from = startOfMonth(today);
      return { key: "month", from, toExclusive: addDays(today, 1), label: `This Month (${formatDayLabel(from)} – ${formatDayLabel(today)})` };
    }
  }
}

function firstOfPrevMonth(startOfThisMonth: string): string {
  const [y, m] = startOfThisMonth.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PH", { year: "numeric", month: "long", timeZone: "UTC" });
}
