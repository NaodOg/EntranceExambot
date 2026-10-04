import { v } from "convex/values";
import { resolveTelegramId } from "./lib/auth";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { periodXpPatch } from "./period";
import {
  bumpUsageStats,
  nextDailyUsagePatch,
  publishedExamCountFor,
  quotaDateFor,
  storedDailyUsage,
  usageLabelForExam,
} from "./quota";
import { calculateNewStreak } from "./streak";
import { marksOf, recordMockMark } from "./marks";
import { attemptModeValues } from "./schema";
import {
  collectQuestionsFromExams,
  durationForCount,
  examMatchesSource,
  listPublishedSubjectExamsForSource,
  MOCK_SITTING_SIZE,
  pastExamLabel,
  questionSourceValidator,
  resolveSourceQuestions,
} from "./questionSource";

/** Upper bound when counting a paper's questions, so a huge paper stays cheap. */
const MAX_QUESTIONS_PER_PAPER = 200;

/**
 * Auth args for question-bearing queries. Mini App callers pass Telegram
 * initData; the trusted bot passes telegramId + botProof. Either way the caller
 * must prove it is a Telegram client before answers are returned.
 */
const viewerArgs = {
  telegramId: v.optional(v.string()),
  initData: v.optional(v.string()),
  botProof: v.optional(v.string()),
};

/** Published subjects inside a track, in catalogue order. */
async function publishedSubjectsFor(ctx: QueryCtx, trackSlug: string) {
  const subjects = await ctx.db
    .query("subjects")
    .withIndex("by_track", (q) => q.eq("trackSlug", trackSlug))
    .collect();

  return subjects
    .filter((subject) => subject.isPublished)
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn, "en"),
    );
}

export const listPublishedTracks = query({
  args: {},
  handler: async (ctx) => {
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();

    // One call returns the whole catalog, so pickers never have to fan out a
    // request per track just to learn which subjects sit inside it.
    const resolved = await Promise.all(
      tracks.map(async (track) => {
        const subjects = await publishedSubjectsFor(ctx, track.slug);
        const counts = await Promise.all(
          subjects.map((subject) =>
            publishedExamCountFor(ctx, subject.slug, subject.publishedExamCount),
          ),
        );
        return {
          ...track,
          subjectCount: subjects.length,
          examCount: counts.reduce((sum, n) => sum + n, 0),
          subjects: subjects.map((subject, i) => ({
            ...subject,
            examCount: counts[i] ?? 0,
          })),
        };
      }),
    );

    return resolved.sort((a, b) =>
      a.nameEn.localeCompare(b.nameEn, "en", { sensitivity: "base" }),
    );
  },
});

export const listPublishedSubjects = query({
  args: { trackSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.trackSlug !== undefined) {
      return publishedSubjectsFor(ctx, args.trackSlug);
    }

    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();

    const all = await Promise.all(
      tracks.map((track) => publishedSubjectsFor(ctx, track.slug)),
    );
    return all.flat();
  },
});

export const listExamsBySubject = query({
  args: { subjectSlug: v.string() },
  handler: async (ctx, args) => {
    const exams = await ctx.db
      .query("exams")
      .withIndex("by_subject_published", (q) =>
        q.eq("subjectSlug", args.subjectSlug).eq("isPublished", true),
      )
      .collect();

    return exams;
  },
});

export const getExamQuestions = query({
  args: { examId: v.id("exams"), ...viewerArgs },
  handler: async (ctx, args) => {
    await resolveTelegramId(args);
    const exam = await ctx.db.get(args.examId);
    if (!exam || !exam.isPublished) {
      return null;
    }

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", args.examId))
      .collect();

    const sorted = questions.sort((a, b) => a.order - b.order);

    return {
      exam,
      questions: await Promise.all(sorted.map((question) => mapQuestionView(ctx, question))),
    };
  },
});

const sourceQuestionView = v.object({
  _id: v.id("questions"),
  order: v.number(),
  unit: v.string(),
  chapter: v.string(),
  textEn: v.string(),
  textAm: v.string(),
  options: v.array(
    v.object({
      key: v.string(),
      textEn: v.string(),
      textAm: v.string(),
    }),
  ),
  correctKey: v.string(),
  explanationEn: v.string(),
  explanationAm: v.string(),
  imageUrl: v.union(v.string(), v.null()),
});

async function mapQuestionView(ctx: QueryCtx | MutationCtx, question: Doc<"questions">) {
  return {
    _id: question._id,
    order: question.order,
    unit: question.unit,
    chapter: question.chapter,
    textEn: question.textEn,
    textAm: question.textAm,
    options: question.options,
    correctKey: question.correctKey,
    explanationEn: question.explanationEn,
    explanationAm: question.explanationAm,
    imageUrl: question.imageId ? await ctx.storage.getUrl(question.imageId) : null,
  };
}

async function applyMistakeStatsDelta(
  ctx: MutationCtx,
  userId: Id<"users">,
  subjectSlug: string,
  totalDelta: number,
  masteredDelta: number,
) {
  if (totalDelta === 0 && masteredDelta === 0) return;
  const existing = await ctx.db
    .query("mistakeStats")
    .withIndex("by_user_subject", (q) =>
      q.eq("userId", userId).eq("subjectSlug", subjectSlug),
    )
    .unique();
  if (!existing) {
    const rows = await ctx.db
      .query("mistakeBank")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", userId).eq("subjectSlug", subjectSlug),
      )
      .collect();
    await ctx.db.insert("mistakeStats", {
      userId,
      subjectSlug,
      totalCount: rows.length,
      masteredCount: rows.filter((row) => row.mastered).length,
    });
    return;
  }
  await ctx.db.patch(existing._id, {
    totalCount: Math.max(0, existing.totalCount + totalDelta),
    masteredCount: Math.max(0, existing.masteredCount + masteredDelta),
  });
}

export const listQuestionSources = query({
  args: { subjectSlug: v.string() },
  returns: v.object({
    mock: v.object({
      available: v.boolean(),
      examCount: v.number(),
      questionCount: v.number(),
    }),
    pastExams: v.array(
      v.object({
        _id: v.id("exams"),
        year: v.number(),
        questionCount: v.number(),
        durationMinutes: v.number(),
        labelEn: v.string(),
        labelAm: v.string(),
      }),
    ),
    all: v.object({
      available: v.boolean(),
      examCount: v.number(),
      questionCount: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const mockExams = await listPublishedSubjectExamsForSource(ctx, args.subjectSlug, "mock");
    const pastExams = await listPublishedSubjectExamsForSource(ctx, args.subjectSlug, "past");
    const yearCounts = new Map<number, number>();
    for (const exam of pastExams) {
      yearCounts.set(exam.year, (yearCounts.get(exam.year) ?? 0) + 1);
    }

    const mockQuestionCount = mockExams.reduce(
      (sum, exam) => sum + (exam.questionCount ?? 0),
      0,
    );
    const pastQuestionCount = pastExams.reduce(
      (sum, exam) => sum + (exam.questionCount ?? 0),
      0,
    );

    return {
      mock: {
        available: mockExams.length > 0,
        examCount: mockExams.length,
        questionCount: mockQuestionCount,
      },
      pastExams: pastExams.map((exam) => {
        const yearCount = yearCounts.get(exam.year) ?? 1;
        return {
          _id: exam._id,
          year: exam.year,
          questionCount: exam.questionCount,
          durationMinutes: exam.durationMinutes,
          labelEn: pastExamLabel(exam, yearCount, "en"),
          labelAm: pastExamLabel(exam, yearCount, "am"),
        };
      }),
      all: {
        available: mockExams.length > 0 || pastExams.length > 0,
        examCount: mockExams.length + pastExams.length,
        questionCount: mockQuestionCount + pastQuestionCount,
      },
    };
  },
});

export const getSourceQuestions = query({
  args: {
    subjectSlug: v.string(),
    source: questionSourceValidator,
    examId: v.optional(v.id("exams")),
    ...viewerArgs,
  },
  returns: v.union(
    v.object({
      hostExamId: v.id("exams"),
      durationMinutes: v.number(),
      titleEn: v.string(),
      questions: v.array(sourceQuestionView),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await resolveTelegramId(args);
    if (args.source === "past") {
      if (!args.examId) return null;
      const exam = await ctx.db.get(args.examId);
      if (!exam || !exam.isPublished || exam.subjectSlug !== args.subjectSlug) {
        return null;
      }
      if (!examMatchesSource(exam, "past")) return null;
      const questions = await ctx.db
        .query("questions")
        .withIndex("by_exam", (q) => q.eq("examId", exam._id))
        .collect();
      const sorted = questions.sort((a, b) => a.order - b.order);
      if (!sorted.length) return null;
      return {
        hostExamId: exam._id,
        durationMinutes: exam.durationMinutes,
        titleEn: exam.titleEn ?? `Past exam ${exam.year}`,
        questions: await Promise.all(sorted.map((question) => mapQuestionView(ctx, question))),
      };
    }

    if (args.source === "all") {
      const resolved = await resolveSourceQuestions(ctx, {
        subjectSlug: args.subjectSlug,
        source: "all",
        mode: "exam",
        shuffle: false,
      });
      if (!resolved) return null;
      return {
        hostExamId: resolved.hostExam._id,
        durationMinutes: resolved.durationMinutes,
        titleEn: "All random",
        questions: await Promise.all(
          resolved.questions.map((question) => mapQuestionView(ctx, question)),
        ),
      };
    }

    const exams = await listPublishedSubjectExamsForSource(ctx, args.subjectSlug, "mock");
    const hostExam = exams[0];
    if (!hostExam) return null;
    const pool = await collectQuestionsFromExams(ctx, exams, 100);
    if (!pool.length) return null;
    return {
      hostExamId: hostExam._id,
      durationMinutes: durationForCount(Math.min(100, pool.length)),
      titleEn: "Mock exam",
      questions: await Promise.all(pool.map((question) => mapQuestionView(ctx, question))),
    };
  },
});

export const prepareSitting = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    subjectSlug: v.string(),
    source: questionSourceValidator,
    examId: v.optional(v.id("exams")),
    mode: v.union(v.literal("quick"), v.literal("exam")),
    questionCount: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      hostExamId: v.id("exams"),
      durationMinutes: v.number(),
      titleEn: v.string(),
      questions: v.array(sourceQuestionView),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user) throw new Error("User not found");
    if (user.isBanned) {
      throw new Error(
        "ACCOUNT_BANNED: This account has been suspended. Contact support if you think this is a mistake.",
      );
    }

    const questionCount =
      args.questionCount === undefined
        ? undefined
        : Math.min(100, Math.max(1, Math.floor(args.questionCount)));
    const resolved = await resolveSourceQuestions(ctx, {
      subjectSlug: args.subjectSlug,
      source: args.source,
      examId: args.examId,
      mode: args.mode,
      shuffle: true,
      questionCount,
    });
    if (!resolved) return null;

    return {
      hostExamId: resolved.hostExam._id,
      durationMinutes: resolved.durationMinutes,
      titleEn:
        args.source === "mock"
          ? "Mock exam"
          : args.source === "all"
            ? "All random"
            : (resolved.hostExam.titleEn ?? `Past exam ${resolved.hostExam.year}`),
      questions: await Promise.all(
        resolved.questions.map((question) => mapQuestionView(ctx, question)),
      ),
    };
  },
});

export const FREE_DAILY_QUESTION_CAP = 20;
export const DAILY_GOAL_MIN = 5;
export const PRO_DAILY_GOAL_MAX = 80;

export function clampDailyGoal(goal: number | undefined, isPro: boolean): number {
  const raw = typeof goal === "number" && Number.isFinite(goal) ? Math.round(goal) : 20;
  const max = isPro ? PRO_DAILY_GOAL_MAX : FREE_DAILY_QUESTION_CAP;
  return Math.min(max, Math.max(DAILY_GOAL_MIN, raw));
}
export const MIN_DUEL_QUESTIONS = 1;
export const MAX_DUEL_QUESTIONS = 100;
export const MIN_DUEL_PLAYERS = 2;
export const MAX_DUEL_PLAYERS = 10;
export const DAILY_LIMIT_ERROR =
  "Daily free limit reached: 20 questions per day, including Duel rooms. Upgrade to Pro (200 ETB) for unlimited access!";

export function utcDayStartMs(now = Date.now()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

export function isProActive(user: Pick<Doc<"users">, "isPro" | "proExpiresAt">, now = Date.now()): boolean {
  return user.isPro && (!user.proExpiresAt || user.proExpiresAt > now);
}

function creatorPlayedDuel(duel: Doc<"duels">): boolean {
  return duel.creatorScore !== undefined || (duel.creatorAnswers?.length ?? 0) > 0;
}

function opponentPlayedDuel(duel: Doc<"duels">): boolean {
  return duel.opponentScore !== undefined || (duel.opponentAnswers?.length ?? 0) > 0;
}

function creatorPlayedAt(duel: Doc<"duels">): number {
  return duel.creatorPlayedAt ?? duel.completedAt ?? duel.createdAt;
}

function opponentPlayedAt(duel: Doc<"duels">): number {
  return duel.opponentPlayedAt ?? duel.completedAt ?? duel.createdAt;
}

export async function listDuelUsageToday(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  startMs: number,
): Promise<Array<{ label: string; questions: number }>> {
  const usage: Array<{ label: string; questions: number }> = [];
  const counted = new Set<string>();

  const seats = await ctx.db
    .query("duelPlayers")
    .withIndex("by_user_played", (q) =>
      q.eq("userId", userId).gte("playedAt", startMs),
    )
    .collect();

  for (const seat of seats) {
    counted.add(seat.duelId);
    const duel = await ctx.db.get(seat.duelId);
    usage.push({
      label: "Duel",
      questions: seat.answers?.length ?? duel?.questionIds.length ?? 0,
    });
  }

  const created = await ctx.db
    .query("duels")
    .withIndex("by_creator", (q) => q.eq("creatorId", userId))
    .collect();
  const joined = await ctx.db
    .query("duels")
    .withIndex("by_opponent", (q) => q.eq("opponentId", userId))
    .collect();

  for (const duel of created) {
    if (counted.has(duel._id)) continue;
    if (!creatorPlayedDuel(duel) || creatorPlayedAt(duel) < startMs) continue;
    usage.push({
      label: "Duel",
      questions: duel.creatorAnswers?.length ?? duel.questionIds.length,
    });
  }
  for (const duel of joined) {
    if (duel.creatorId === userId || counted.has(duel._id)) continue;
    if (!opponentPlayedDuel(duel) || opponentPlayedAt(duel) < startMs) continue;
    usage.push({
      label: "Duel",
      questions: duel.opponentAnswers?.length ?? duel.questionIds.length,
    });
  }

  return usage;
}

export async function countDuelQuestionsToday(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  startMs: number,
): Promise<number> {
  const usage = await listDuelUsageToday(ctx, userId, startMs);
  return usage.reduce((sum, item) => sum + item.questions, 0);
}

export async function countQuestionsToday(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  startMs: number,
  user?: Doc<"users"> | null,
): Promise<number> {
  const today = quotaDateFor(startMs || Date.now());
  if (user) {
    if (user.dailyQuotaDate === today) {
      return user.dailyQuestionsUsed ?? 0;
    }
    if (user.dailyQuotaDate) {
      return 0;
    }
  }

  const attemptsToday = await ctx.db
    .query("attempts")
    .withIndex("by_user", (q) => q.eq("userId", userId).gte("completedAt", startMs))
    .collect();

  const examQuestions = attemptsToday.reduce(
    (sum, attempt) => sum + (attempt.totalQuestions ?? 0),
    0,
  );
  const duelQuestions = await countDuelQuestionsToday(ctx, userId, startMs);
  return examQuestions + duelQuestions;
}

export async function remainingFreeQuestions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  startMs: number,
  user?: Doc<"users"> | null,
): Promise<number> {
  const used = await countQuestionsToday(ctx, userId, startMs, user);
  return Math.max(0, FREE_DAILY_QUESTION_CAP - used);
}

/**
 * How many questions a whole paper has, derived on the server so a client
 * cannot claim a full sitting it was never served.
 *
 * A sitting drawn from one exam is complete when it covers that exam's
 * questions. Mock sittings instead pool questions across every published exam
 * of the subject, so completeness is measured against that whole pool, capped
 * at the standard sitting size.
 */
async function fullPaperQuestionCount(
  ctx: MutationCtx,
  exam: Doc<"exams">,
  contributingExamIds: Set<string>,
): Promise<number> {
  if (contributingExamIds.size === 1 && contributingExamIds.has(exam._id)) {
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", exam._id))
      .take(MAX_QUESTIONS_PER_PAPER);
    // Measure what the paper really holds, not the admin-entered questionCount,
    // so a stale count cannot make a completed paper look partial.
    return Math.min(MOCK_SITTING_SIZE, questions.length);
  }

  const exams = await ctx.db
    .query("exams")
    .withIndex("by_subject_published", (q) =>
      q.eq("subjectSlug", exam.subjectSlug).eq("isPublished", true),
    )
    .collect();
  if (!exams.length) return 0;

  const pool = await collectQuestionsFromExams(ctx, exams, MAX_QUESTIONS_PER_PAPER);
  return Math.min(MOCK_SITTING_SIZE, pool.length);
}

export async function gradeAndSaveAttempt(
  ctx: MutationCtx,
  args: {
    telegramId: string;
    examId: Id<"exams">;
    mode?: "quick" | "mock" | "practice" | "mistakes" | "daily";
    answers: Array<{
      questionId: Id<"questions">;
      selectedKey: string;
      timeSec: number;
    }>;
    durationSec: number;
    bonusXp?: number;
    maxCombo?: number;
  },
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId))
    .unique();

  if (!user) {
    throw new Error("User not found");
  }

  const exam = await ctx.db.get(args.examId);
  if (!exam) {
    throw new Error("Exam not found");
  }

  const now = Date.now();
  const isPro = isProActive(user, now);
  let answersToGrade = args.answers;

  if (!isPro) {
    const startMs = utcDayStartMs(now);
    const questionsToday = await countQuestionsToday(ctx, user._id, startMs, user);

    if (questionsToday >= FREE_DAILY_QUESTION_CAP) {
      throw new Error(DAILY_LIMIT_ERROR);
    }

    const remainingToday = Math.max(0, FREE_DAILY_QUESTION_CAP - questionsToday);
    if (answersToGrade.length > remainingToday) {
      answersToGrade = answersToGrade.slice(0, remainingToday);
    }
  }

  let score = 0;
  let availableMarks = 0;
  let correctCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let bonusXp = 0;
  const gradedAnswers = [];
  let mistakeTotalDelta = 0;
  let mistakeMasteredDelta = 0;
  // Mock sittings pool questions from several exams, so the host exam is only
  // a container. Track which exams the graded questions actually came from to
  // tell a whole paper apart from a slice of one.
  const contributingExamIds = new Set<string>();

  const answerRows = await Promise.all(
    answersToGrade.map(async (answer) => ({
      answer,
      question: await ctx.db.get(answer.questionId),
      existingMistake: await ctx.db
        .query("mistakeBank")
        .withIndex("by_user_question", (q) =>
          q.eq("userId", user._id).eq("questionId", answer.questionId),
        )
        .unique(),
    })),
  );

  for (const { answer, question, existingMistake } of answerRows) {
    if (!question) {
      continue;
    }

    // Only questions from a published exam in this subject may be graded, so a
    // caller cannot submit answers borrowed from another paper or subject.
    if (question.examId !== exam._id) {
      const owner = await ctx.db.get(question.examId);
      if (!owner || !owner.isPublished || owner.subjectSlug !== exam.subjectSlug) {
        continue;
      }
    }

    const marks = marksOf(question);
    const isCorrect = question.correctKey === answer.selectedKey;

    availableMarks += marks;
    contributingExamIds.add(String(question.examId));

    if (isCorrect) {
      score += marks;
      correctCount += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      bonusXp += combo >= 5 ? 10 : combo >= 3 ? 5 : combo >= 2 ? 2 : 0;

      if (existingMistake && !existingMistake.mastered) {
        await ctx.db.patch(existingMistake._id, {
          mastered: true,
          lastAttemptAt: now,
        });
        mistakeMasteredDelta += 1;
      }
    } else {
      combo = 0;
      if (existingMistake) {
        await ctx.db.patch(existingMistake._id, {
          wrongCount: existingMistake.wrongCount + 1,
          mastered: false,
          lastAttemptAt: now,
        });
        if (existingMistake.mastered) mistakeMasteredDelta -= 1;
      } else {
        await ctx.db.insert("mistakeBank", {
          userId: user._id,
          questionId: answer.questionId,
          subjectSlug: exam.subjectSlug,
          examId: args.examId,
          wrongCount: 1,
          mastered: false,
          lastAttemptAt: now,
        });
        mistakeTotalDelta += 1;
      }
    }

    gradedAnswers.push({
      questionId: answer.questionId,
      selectedKey: answer.selectedKey,
      isCorrect,
      marks,
      timeSec: answer.timeSec,
    });
  }

  await applyMistakeStatsDelta(
    ctx,
    user._id,
    exam.subjectSlug,
    mistakeTotalDelta,
    mistakeMasteredDelta,
  );

  const subject = await ctx.db
    .query("subjects")
    .withIndex("by_slug", (q) => q.eq("slug", exam.subjectSlug))
    .unique();

  const attemptId = await ctx.db.insert("attempts", {
    userId: user._id,
    examId: args.examId,
    subjectSlug: exam.subjectSlug,
    trackSlug: exam.trackSlug ?? subject?.trackSlug ?? user.trackSlug ?? undefined,
    mode: args.mode,
    score,
    availableMarks,
    correctCount,
    totalQuestions: gradedAnswers.length,
    durationSec: args.durationSec,
    answers: gradedAnswers,
    completedAt: now,
  });

  // A mark only counts when the student sat a whole paper. Both halves are
  // checked here: the declared mode, and whether the graded set actually
  // covered every question available to that paper. A free-plan answer that was
  // trimmed by the daily cap therefore never produces a mark. Only full mock
  // sittings pay for the coverage lookup.
  let wroteMark = false;
  if (args.mode === "mock" && subject) {
    const fullPaperSize = await fullPaperQuestionCount(
      ctx,
      exam,
      contributingExamIds,
    );
    if (fullPaperSize > 0 && gradedAnswers.length >= fullPaperSize) {
      wroteMark = await recordMockMark(ctx, {
        userId: user._id,
        attemptId,
        trackSlug: subject.trackSlug,
        subjectSlug: exam.subjectSlug,
        score,
        availableMarks,
        subjectMaxMarks: subject.maxMarks ?? availableMarks,
        label: exam.titleEn ?? undefined,
        createdAt: now,
      });
    }
  }

  const xpGain = correctCount * 10 + bonusXp;

  const streakResult = calculateNewStreak(
    {
      streakCount: user.streakCount,
      lastPracticeDate: user.lastPracticeDate,
      lastPracticeAt: user.lastPracticeAt,
    },
    now,
  );

  const quotaPatch = nextDailyUsagePatch(user, now, {
    questions: gradedAnswers.length,
    label: usageLabelForExam(gradedAnswers.length, exam.titleEn),
  });

  await ctx.db.patch(user._id, {
    xp: user.xp + xpGain,
    lastActiveAt: now,
    lastPracticeAt: streakResult.lastPracticeAt,
    lastPracticeDate: streakResult.lastPracticeDate,
    streakCount: streakResult.streakCount,
    ...periodXpPatch(user, now, xpGain),
    ...quotaPatch,
  });
  await bumpUsageStats(ctx, String(user._id), { attempts: 1, totalXp: xpGain });

  return {
    attemptId,
    score,
    availableMarks,
    correctCount,
    totalQuestions: gradedAnswers.length,
    xpGain,
    bonusXp,
    maxCombo,
    streakCount: streakResult.streakCount,
    isPro,
    markRecorded: wroteMark,
  };
}

export const submitAttempt = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    examId: v.id("exams"),
    mode: v.optional(attemptModeValues),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedKey: v.string(),
        timeSec: v.number(),
      }),
    ),
    durationSec: v.number(),
    bonusXp: v.optional(v.number()),
    maxCombo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    return await gradeAndSaveAttempt(ctx, args);
  },
});

export const getAttemptReview = query({
  args: {
    attemptId: v.id("attempts"),
    telegramId: v.optional(v.string()),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) {
      return null;
    }

    const actorId = await resolveTelegramId({
      telegramId: args.telegramId,
      initData: args.initData,
      botProof: args.botProof,
    });
    const actor = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", actorId))
      .unique();
    if (!actor || attempt.userId !== actor._id) {
      return null;
    }

    const details = await Promise.all(
      attempt.answers.map(async (answer) => {
        const question = await ctx.db.get(answer.questionId);
        if (!question) {
          return null;
        }

        return {
          ...answer,
          question: {
            textEn: question.textEn,
            textAm: question.textAm,
            options: question.options,
            correctKey: question.correctKey,
            explanationEn: question.explanationEn,
            explanationAm: question.explanationAm,
          },
        };
      }),
    );

    const exam = await ctx.db.get(attempt.examId);
    const available = attempt.availableMarks ?? attempt.totalQuestions;

    return {
      ...attempt,
      exam,
      percent: available ? Math.round((attempt.score / available) * 100) : 0,
      details: details.filter(Boolean),
    };
  },
});

const attemptListItem = v.object({
  _id: v.id("attempts"),
  score: v.number(),
  availableMarks: v.number(),
  totalQuestions: v.number(),
  durationSec: v.number(),
  completedAt: v.number(),
  percent: v.number(),
  examTitle: v.string(),
  subjectName: v.optional(v.string()),
});

export const listMyAttempts = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(attemptListItem),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      return { items: [], hasMore: false };
    }

    const limit = Math.max(1, Math.min(args.limit ?? 10, 40));
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit + 1);

    const hasMore = attempts.length > limit;
    const page = attempts.slice(0, limit);

    const items = await Promise.all(
      page.map(async (attempt) => {
        const exam = await ctx.db.get(attempt.examId);
        const subject = exam
          ? await ctx.db
              .query("subjects")
              .withIndex("by_slug", (q) => q.eq("slug", exam.subjectSlug))
              .unique()
          : null;

        return {
          _id: attempt._id,
          score: attempt.score,
          availableMarks: attempt.availableMarks ?? attempt.totalQuestions,
          totalQuestions: attempt.totalQuestions,
          durationSec: attempt.durationSec,
          completedAt: attempt.completedAt,
          percent: attempt.availableMarks ?? attempt.totalQuestions
            ? Math.round(
                (attempt.score /
                  (attempt.availableMarks ?? attempt.totalQuestions)) *
                  100,
              )
            : 0,
          examTitle: exam?.titleEn ?? subject?.nameEn ?? "EXAM",
          subjectName: subject?.nameEn,
        };
      }),
    );

    return { items, hasMore };
  },
});

export const toggleBookmark = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_question", (q) =>
        q.eq("userId", user._id).eq("questionId", args.questionId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { bookmarked: false };
    }

    await ctx.db.insert("bookmarks", {
      userId: user._id,
      questionId: args.questionId,
    });
    return { bookmarked: true };
  },
});

export const reportQuestion = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    questionId: v.id("questions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user) throw new Error("User not found");

    const reason = args.reason.trim().slice(0, 500);
    if (reason.length < 1) throw new Error("Reason required");

    const existing = await ctx.db
      .query("questionReports")
      .withIndex("by_user_question", (q) =>
        q.eq("userId", user._id).eq("questionId", args.questionId),
      )
      .filter((q) => q.eq(q.field("status"), "open"))
      .first();
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("questionReports", {
      userId: user._id,
      questionId: args.questionId,
      reason,
      reporterUsername: user.username,
      reporterTelegramId: user.telegramId,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

export const listMistakes = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    subjectSlug: v.optional(v.string()),
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      return {
        isPro: false,
        totalCount: 0,
        masteredCount: 0,
        unmasteredCount: 0,
        items: [],
        hasMore: false,
      };
    }

    const now = args.nowMs ?? 0;
    const isPro = user.isPro && (!user.proExpiresAt || user.proExpiresAt > now);
    const limit = Math.max(1, Math.min(args.limit ?? 20, 60));
    const pageWithLookAhead = isPro
      ? args.subjectSlug
        ? await ctx.db
            .query("mistakeBank")
            .withIndex("by_user_subject_time", (q) =>
              q.eq("userId", user._id).eq("subjectSlug", args.subjectSlug!),
            )
            .order("desc")
            .take(limit + 1)
        : await ctx.db
            .query("mistakeBank")
            .withIndex("by_user_time", (q) => q.eq("userId", user._id))
            .order("desc")
            .take(limit + 1)
      : [];
    const page = pageWithLookAhead.slice(0, limit);
    const hasMore = pageWithLookAhead.length > limit;

    const stats = args.subjectSlug
      ? await ctx.db
          .query("mistakeStats")
          .withIndex("by_user_subject", (q) =>
            q.eq("userId", user._id).eq("subjectSlug", args.subjectSlug!),
          )
          .unique()
      : null;
    const allStats = args.subjectSlug
      ? []
      : await ctx.db
          .query("mistakeStats")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
    let totalCount = stats
      ? stats.totalCount
      : allStats.reduce((sum, row) => sum + row.totalCount, 0);
    let masteredCount = stats
      ? stats.masteredCount
      : allStats.reduce((sum, row) => sum + row.masteredCount, 0);
    if (!stats && allStats.length === 0 && pageWithLookAhead.length > 0) {
      const legacyRows = args.subjectSlug
        ? await ctx.db
            .query("mistakeBank")
            .withIndex("by_user_subject", (q) =>
              q.eq("userId", user._id).eq("subjectSlug", args.subjectSlug!),
            )
            .collect()
        : await ctx.db
            .query("mistakeBank")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();
      totalCount = legacyRows.length;
      masteredCount = legacyRows.filter((row) => row.mastered).length;
    }
    const unmasteredCount = totalCount - masteredCount;

    const items = await Promise.all(
      page.map(async (m) => {
        const question = await ctx.db.get(m.questionId);
        const exam = m.examId ? await ctx.db.get(m.examId) : null;
        return {
          ...m,
          question,
          examTitle: exam?.titleEn ?? "Practice exam",
        };
      }),
    );

    return {
      isPro,
      totalCount,
      masteredCount,
      unmasteredCount,
      items: items.filter((i) => i.question !== null),
      hasMore,
    };
  },
});

export const getDailyQuota = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    todayStartMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      return {
        isPro: false,
        questionsToday: 0,
        freeQuestionsLeft: FREE_DAILY_QUESTION_CAP,
        freeQuestionsMax: FREE_DAILY_QUESTION_CAP,
        usageToday: [] as Array<{ label: string; questions: number }>,
        duelsToday: 0,
        freeDuelsLeft: 0,
        freeDuelsMax: 0,
      };
    }

    const startMs = args.todayStartMs ?? 0;
    const isPro = user.isPro && (!user.proExpiresAt || user.proExpiresAt > startMs);
    const today = quotaDateFor(startMs);
    const stored = storedDailyUsage(user, today);
    const questionsToday = stored
      ? stored.questions
      : user.dailyQuotaDate
        ? 0
        : await countQuestionsToday(ctx, user._id, startMs, user);
    const duelsToday = stored
      ? stored.duels
      : user.dailyQuotaDate
        ? 0
        : (await listDuelUsageToday(ctx, user._id, startMs)).length;
    const usageToday = stored?.usage ?? [];
    const freeQuestionsLeft = isPro
      ? 9999
      : Math.max(0, FREE_DAILY_QUESTION_CAP - questionsToday);

    return {
      isPro,
      questionsToday,
      freeQuestionsLeft,
      freeQuestionsMax: FREE_DAILY_QUESTION_CAP,
      usageToday,
      duelsToday,
      freeDuelsLeft: isPro ? 9999 : freeQuestionsLeft >= MIN_DUEL_QUESTIONS ? 1 : 0,
      freeDuelsMax: 0,
    };
  },
});

export const getMistakeQuiz = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    subjectSlug: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) return null;
    if (user.isBanned) return null;

    const isPro = user.isPro && (!user.proExpiresAt || user.proExpiresAt > (args.nowMs ?? 0));
    if (!isPro) {
      return {
        isPro: false,
        questions: [],
        totalMistakes: 0,
      };
    }

    const mistakes = args.subjectSlug
      ? await ctx.db
          .query("mistakeBank")
          .withIndex("by_user_subject_mastered_time", (q) =>
            q
              .eq("userId", user._id)
              .eq("subjectSlug", args.subjectSlug!)
              .eq("mastered", false),
          )
          .order("desc")
          .take(20)
      : await ctx.db
          .query("mistakeBank")
          .withIndex("by_user_mastered_time", (q) =>
            q.eq("userId", user._id).eq("mastered", false),
          )
          .order("desc")
          .take(20);

    const unmastered = mistakes;
    const questions = await Promise.all(
      unmastered.slice(0, 20).map(async (m, i) => {
        const question = await ctx.db.get(m.questionId);
        if (!question) return null;
        return {
          _id: question._id,
          order: i + 1,
          unit: question.unit,
          chapter: question.chapter,
          textEn: question.textEn,
          textAm: question.textAm,
          options: question.options,
          correctKey: question.correctKey,
          explanationEn: question.explanationEn,
          explanationAm: question.explanationAm,
          imageUrl: question.imageId ? await ctx.storage.getUrl(question.imageId) : null,
        };
      }),
    );

    const validQuestions = questions.filter((q): q is NonNullable<typeof q> => q !== null);

    const subjectSlug = args.subjectSlug ?? user.trackSlug ?? "";
    const mistakeStats = await ctx.db
      .query("mistakeStats")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", user._id).eq("subjectSlug", subjectSlug),
      )
      .unique();
    const fallbackExam = await ctx.db
      .query("exams")
      .withIndex("by_subject", (q) => q.eq("subjectSlug", subjectSlug))
      .first();

    return {
      isPro: true,
      exam: {
        _id: fallbackExam?._id,
        titleEn: "Mistake Bank Drill",
        titleAm: "የስህተት ባንክ ልምምድ",
        durationMinutes: Math.max(5, Math.ceil(validQuestions.length * 1.5)),
        questionCount: validQuestions.length,
      },
      questions: validQuestions,
      totalMistakes: mistakeStats
        ? mistakeStats.totalCount - mistakeStats.masteredCount
        : unmastered.length,
    };
  },
});
