export type QuestionSource = "mock" | "past" | "all";
export type SittingMode = "quick" | "exam";

export const EXAM_COUNT_PRESETS = [15, 30, 50, 100] as const;
export const MIN_EXAM_COUNT = 1;
export const MAX_EXAM_COUNT = 100;

export function parseExamCount(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < MIN_EXAM_COUNT || parsed > MAX_EXAM_COUNT) return null;
  return parsed;
}

export function examCountChoices(dailyGoal: number): Array<{
  count: number;
  isGoal: boolean;
}> {
  const goal = Math.round(dailyGoal);
  const choices: Array<{ count: number; isGoal: boolean }> = EXAM_COUNT_PRESETS.map((count) => ({
    count,
    isGoal: false,
  }));
  if (goal >= MIN_EXAM_COUNT && goal <= MAX_EXAM_COUNT) {
    choices.push({ count: goal, isGoal: true });
  }
  return choices;
}

export const MINUTES_PER_QUESTION = 1.5;
export const DUEL_MINUTES_PER_QUESTION = 1;

export function sittingMinutes(count: number): number {
  return Math.max(1, Math.round(count * MINUTES_PER_QUESTION));
}

export function duelMinutes(count: number): number {
  return Math.max(1, Math.round(count * DUEL_MINUTES_PER_QUESTION));
}

export function duelSeconds(count: number): number {
  return Math.max(60, Math.round(count * DUEL_MINUTES_PER_QUESTION * 60));
}

export function shuffleCopy<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = next[i];
    const swap = next[j];
    if (current === undefined || swap === undefined) continue;
    next[i] = swap;
    next[j] = current;
  }
  return next;
}

export function buildExamHref(opts: {
  subjectSlug: string;
  sitting: SittingMode;
  source: QuestionSource;
  examId?: string;
  count?: number;
}): string {
  const params = new URLSearchParams({
    subject: opts.subjectSlug,
    source: opts.source,
  });
  if (opts.sitting === "quick") params.set("mode", "quick");
  if (opts.examId) params.set("exam", opts.examId);
  if (opts.count) params.set("count", String(opts.count));
  return `/app/exam?${params.toString()}`;
}
