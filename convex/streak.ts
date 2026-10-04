/**
 * Robust streak calculation helper for Exam Bot.
 *
 * All dates are normalized to calendar date strings (YYYY-MM-DD) in Ethiopia/East Africa Time (UTC+3),
 * which aligns with Ethiopian Ministry exam candidates, or UTC date boundaries.
 * Using calendar date strings eliminates daylight savings / timezone shift bugs and prevents
 * 23-hour vs 25-hour timestamp drift.
 */

// Ethiopia is in UTC+3 year-round (no DST).
const TIMEZONE_OFFSET_HOURS = 3;

/**
 * Returns YYYY-MM-DD in UTC+3 for a given timestamp.
 */
export function getCalendarDateString(timestampMs: number = Date.now()): string {
  const adjusted = new Date(timestampMs + TIMEZONE_OFFSET_HOURS * 3600 * 1000);
  const year = adjusted.getUTCFullYear();
  const month = String(adjusted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(adjusted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD into epoch day index (number of days since Jan 1 1970).
 */
export function dateStringToEpochDay(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / (24 * 3600 * 1000));
}

export interface StreakUserFields {
  streakCount: number;
  lastPracticeDate?: string;
  lastPracticeAt?: number;
}

/**
 * Calculates updated streak count when user completes practice (exam or duel).
 */
export function calculateNewStreak(
  user: StreakUserFields,
  nowMs: number = Date.now(),
): {
  streakCount: number;
  lastPracticeAt: number;
  lastPracticeDate: string;
  isNewDay: boolean;
} {
  const todayStr = getCalendarDateString(nowMs);
  const todayDay = dateStringToEpochDay(todayStr);

  // If user has a lastPracticeDate, calculate calendar day difference
  let lastDay = 0;
  if (user.lastPracticeDate) {
    lastDay = dateStringToEpochDay(user.lastPracticeDate);
  } else if (user.lastPracticeAt) {
    lastDay = dateStringToEpochDay(getCalendarDateString(user.lastPracticeAt));
  }

  const currentStreak = user.streakCount || 0;

  if (lastDay === 0) {
    // First practice ever
    return {
      streakCount: 1,
      lastPracticeAt: nowMs,
      lastPracticeDate: todayStr,
      isNewDay: true,
    };
  }

  const diffDays = todayDay - lastDay;

  if (diffDays === 0) {
    // Same day practice: streak remains unchanged, but at least 1
    return {
      streakCount: Math.max(1, currentStreak),
      lastPracticeAt: nowMs,
      lastPracticeDate: todayStr,
      isNewDay: false,
    };
  } else if (diffDays === 1) {
    // Consecutive day: increment streak
    return {
      streakCount: Math.max(0, currentStreak) + 1,
      lastPracticeAt: nowMs,
      lastPracticeDate: todayStr,
      isNewDay: true,
    };
  } else {
    // Missed 1 or more calendar days: streak resets to 1
    return {
      streakCount: 1,
      lastPracticeAt: nowMs,
      lastPracticeDate: todayStr,
      isNewDay: true,
    };
  }
}

/**
 * Computes the real-time active streak for passive display (e.g. in profile/home query).
 * If the user's last practice was today or yesterday, streak is still active.
 * If the user's last practice was 2+ calendar days ago, the streak has lapsed and displays as 0.
 */
export function getActiveDisplayStreak(
  user: StreakUserFields,
  nowMs: number = Date.now(),
): number {
  if (!user.streakCount || user.streakCount <= 0) return 0;

  let lastDay = 0;
  if (user.lastPracticeDate) {
    lastDay = dateStringToEpochDay(user.lastPracticeDate);
  } else if (user.lastPracticeAt) {
    lastDay = dateStringToEpochDay(getCalendarDateString(user.lastPracticeAt));
  }

  if (lastDay === 0) {
    // If no practice record exists, fallback to user's streakCount
    return user.streakCount;
  }

  const todayStr = getCalendarDateString(nowMs);
  const todayDay = dateStringToEpochDay(todayStr);
  const diffDays = todayDay - lastDay;

  // diffDays === 0: Practiced today -> active
  // diffDays === 1: Practiced yesterday (streak still alive for today!) -> active
  // diffDays > 1: Missed at least one full day -> lapsed to 0
  if (diffDays <= 1) {
    return user.streakCount;
  }

  return 0;
}
