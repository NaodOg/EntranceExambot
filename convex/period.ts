const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export type LeaderboardPeriod = "biweekly" | "monthly" | "all_time";

function addisParts(nowMs: number) {
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

export function periodWindowStart(period: Exclude<LeaderboardPeriod, "all_time">, nowMs: number) {
  const { year, month, day } = addisParts(nowMs);
  if (period === "monthly") {
    return addisMidnight(year, month, 1);
  }
  const startDay = day <= 14 ? 1 : 15;
  return addisMidnight(year, month, startDay);
}

export function periodXpPatch(
  user: {
    biweeklyXp?: number;
    biweeklyWindowStart?: number;
    monthlyXp?: number;
    monthlyWindowStart?: number;
  },
  nowMs: number,
  gain: number,
) {
  if (gain === 0) {
    return {};
  }
  const biweeklyStart = periodWindowStart("biweekly", nowMs);
  const monthlyStart = periodWindowStart("monthly", nowMs);
  const biweeklyXp =
    user.biweeklyWindowStart === biweeklyStart ? (user.biweeklyXp ?? 0) : 0;
  const monthlyXp =
    user.monthlyWindowStart === monthlyStart ? (user.monthlyXp ?? 0) : 0;
  return {
    biweeklyXp: biweeklyXp + gain,
    biweeklyWindowStart: biweeklyStart,
    monthlyXp: monthlyXp + gain,
    monthlyWindowStart: monthlyStart,
  };
}

export function storedPeriodXp(
  user: {
    biweeklyXp?: number;
    biweeklyWindowStart?: number;
    monthlyXp?: number;
    monthlyWindowStart?: number;
  },
  period: LeaderboardPeriod,
  windowStartMs: number,
) {
  if (period === "biweekly") {
    return user.biweeklyWindowStart === windowStartMs ? (user.biweeklyXp ?? 0) : 0;
  }
  if (period === "monthly") {
    return user.monthlyWindowStart === windowStartMs ? (user.monthlyXp ?? 0) : 0;
  }
  return 0;
}
