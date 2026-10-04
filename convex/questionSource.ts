import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const questionSourceValidator = v.union(
  v.literal("mock"),
  v.literal("past"),
  v.literal("all"),
);
export type QuestionSource = "mock" | "past" | "all";

export const MOCK_SITTING_SIZE = 100;

export function examMatchesSource(
  exam: Pick<Doc<"exams">, "variant">,
  source: QuestionSource,
): boolean {
  if (source === "all") return true;
  return source === "mock" ? exam.variant === "model" : exam.variant === "regular";
}

export function sourceVariant(source: QuestionSource): "model" | "regular" {
  return source === "mock" ? "model" : "regular";
}

export async function listPublishedSubjectExamsForSource(
  ctx: QueryCtx | MutationCtx,
  subjectSlug: string,
  source: QuestionSource,
): Promise<Doc<"exams">[]> {
  const exams = await ctx.db
    .query("exams")
    .withIndex("by_subject_variant_published", (q) =>
      q
        .eq("subjectSlug", subjectSlug)
        .eq("variant", sourceVariant(source))
        .eq("isPublished", true),
    )
    .order("desc")
    .collect();
  return exams
    .sort((a, b) => b.year - a.year || a._id.localeCompare(b._id));
}

export async function collectQuestionsFromExams(
  ctx: QueryCtx | MutationCtx,
  exams: Doc<"exams">[],
  maxQuestions: number,
): Promise<Doc<"questions">[]> {
  const boundedLimit = Math.max(1, maxQuestions);
  const questions: Doc<"questions">[] = [];

  for (const exam of exams) {
    const remaining = boundedLimit - questions.length;
    if (remaining <= 0) break;
    const batch = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", exam._id))
      .take(remaining);
    questions.push(...batch);
  }

  const examOrder = new Map(exams.map((exam, index) => [exam._id, index]));
  return questions.sort((a, b) => {
      const examDiff = (examOrder.get(a.examId) ?? 0) - (examOrder.get(b.examId) ?? 0);
      if (examDiff !== 0) return examDiff;
      return a.order - b.order;
    });
}

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = items[i];
    const swap = items[j];
    if (current === undefined || swap === undefined) continue;
    items[i] = swap;
    items[j] = current;
  }
  return items;
}

export function sittingSize(
  mode: "quick" | "exam",
  available: number,
  source: QuestionSource = "mock",
  questionCount?: number,
): number {
  if (mode === "quick") return Math.min(10, available);
  if (questionCount !== undefined) {
    return Math.min(MOCK_SITTING_SIZE, available, Math.max(1, Math.floor(questionCount)));
  }
  if (source === "past") return available;
  return Math.min(MOCK_SITTING_SIZE, available);
}

export const MINUTES_PER_QUESTION = 1.5;
export const DUEL_MINUTES_PER_QUESTION = 1;

export function durationForCount(count: number): number {
  return Math.max(1, Math.round(count * MINUTES_PER_QUESTION));
}

export function timerSecForCount(count: number): number {
  return Math.max(60, Math.round(count * DUEL_MINUTES_PER_QUESTION * 60));
}

export function pastExamLabel(
  exam: Pick<Doc<"exams">, "year" | "titleEn" | "titleAm" | "questionCount">,
  yearCount: number,
  lang: "en" | "am" = "en",
): string {
  const title = (lang === "am" ? exam.titleAm : exam.titleEn)?.trim();
  const cleaned = title?.replace(/\s+/g, " ");
  if (cleaned) {
    const short = cleaned.length > 40 ? `${cleaned.slice(0, 40).trimEnd()}â€¦` : cleaned;
    return short;
  }
  if (yearCount <= 1) return String(exam.year);
  return `${exam.year} Â· ${exam.questionCount} Q`;
}

export async function resolveSourceQuestions(
  ctx: QueryCtx | MutationCtx,
  args: {
    subjectSlug: string;
    source: QuestionSource;
    examId?: Id<"exams">;
    mode: "quick" | "exam";
    shuffle: boolean;
    questionCount?: number;
  },
): Promise<{
  hostExam: Doc<"exams">;
  questions: Doc<"questions">[];
  durationMinutes: number;
} | null> {
  if (args.source === "past") {
    if (!args.examId) return null;
    const exam = await ctx.db.get(args.examId);
    if (!exam || !exam.isPublished || exam.subjectSlug !== args.subjectSlug) {
      return null;
    }
    if (!examMatchesSource(exam, "past")) return null;
    const ordered = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", exam._id))
      .take(Math.max(exam.questionCount, 100));
    const questions = ordered.sort((a, b) => a.order - b.order);
    const limit = sittingSize(args.mode, questions.length, "past", args.questionCount);
    const picked = args.shuffle
      ? shuffleInPlace([...questions]).slice(0, limit)
      : questions.slice(0, limit);
    if (!picked.length) return null;
    return {
      hostExam: exam,
      questions: picked,
      durationMinutes:
        args.mode === "quick"
          ? 0
          : args.questionCount
            ? durationForCount(picked.length)
            : exam.durationMinutes,
    };
  }

  if (args.source === "all") {
    const exams = await ctx.db
      .query("exams")
      .withIndex("by_subject_published", (q) =>
        q.eq("subjectSlug", args.subjectSlug).eq("isPublished", true),
      )
      .collect();
    if (!exams.length) return null;
    const sorted = exams.sort((a, b) => b.year - a.year || a._id.localeCompare(b._id));
    const hostExam = sorted[0];
    if (!hostExam) return null;

    const targetLimit =
      args.mode === "quick"
        ? 10
        : sittingSize("exam", MOCK_SITTING_SIZE, "mock", args.questionCount);
    const poolCap = Math.min(Math.max(targetLimit * 4, 40), 120);
    const examOrder = args.shuffle ? shuffleInPlace([...sorted]) : sorted;
    const pool = await collectQuestionsFromExams(ctx, examOrder, poolCap);
    if (!pool.length) return null;
    const pickedLimit = sittingSize(args.mode, pool.length, "mock", args.questionCount);
    const picked = args.shuffle
      ? shuffleInPlace([...pool]).slice(0, pickedLimit)
      : pool.slice(0, pickedLimit);
    if (!picked.length) return null;
    return {
      hostExam,
      questions: picked,
      durationMinutes: args.mode === "quick" ? 0 : durationForCount(picked.length),
    };
  }

  const exams = await listPublishedSubjectExamsForSource(ctx, args.subjectSlug, "mock");
  if (!exams.length) return null;
  const hostExam = exams[0];
  if (!hostExam) return null;
  const limit =
    args.mode === "quick"
      ? 10
      : sittingSize("exam", MOCK_SITTING_SIZE, "mock", args.questionCount);
  const examOrder = args.shuffle ? shuffleInPlace([...exams]) : exams;
  const pool = await collectQuestionsFromExams(ctx, examOrder, limit);
  if (!pool.length) return null;
  const pickedLimit = sittingSize(args.mode, pool.length, "mock", args.questionCount);
    const picked = args.shuffle
      ? shuffleInPlace([...pool]).slice(0, pickedLimit)
      : pool.slice(0, pickedLimit);
  if (!picked.length) return null;
  return {
    hostExam,
    questions: picked,
    durationMinutes: args.mode === "quick" ? 0 : durationForCount(picked.length),
  };
}
