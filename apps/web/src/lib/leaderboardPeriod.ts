export type LeaderboardPeriod = "biweekly" | "monthly" | "all_time";

const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export function addisParts(nowMs: number) {
  const shifted = new Date(nowMs + ADDIS_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function addisMidnight(year: number, month: number, day: number) {
  return Date.UTC(year, month, day) - ADDIS_OFFSET_MS;
}

export function periodWindow(period: LeaderboardPeriod, nowMs: number) {
  if (period === "all_time") {
    return { startMs: 0, endMs: nowMs };
  }

  const { year, month, day } = addisParts(nowMs);
  if (period === "monthly") {
    return { startMs: addisMidnight(year, month, 1), endMs: nowMs };
  }

  const startDay = day <= 14 ? 1 : 15;
  return { startMs: addisMidnight(year, month, startDay), endMs: nowMs };
}

export function periodRangeLabel(period: LeaderboardPeriod, nowMs: number) {
  if (period === "all_time") return "All-time";

  const { year, month, day } = addisParts(nowMs);
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  if (period === "monthly") {
    return `${monthLabel} ${year}`;
  }

  const startDay = day <= 14 ? 1 : 15;
  const endDay = day <= 14 ? 14 : lastDay;
  return `${monthLabel} ${startDay}–${endDay}`;
}
