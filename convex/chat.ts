import { v } from "convex/values";
import { resolveTelegramId } from "./lib/auth";
import { resolveNowMs } from "./lib/now";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  FREE_DAILY_QUESTION_CAP,
  clampDailyGoal,
  countQuestionsToday,
  gradeAndSaveAttempt,
  isProActive,
  utcDayStartMs,
} from "./exams";
import { questionSourceValidator, resolveSourceQuestions } from "./questionSource";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const FREE_DAILY_CAP = FREE_DAILY_QUESTION_CAP;

const sessionMode = v.union(
  v.literal("quick"),
  v.literal("mock"),
  v.literal("daily"),
  v.literal("mistakes"),
);

const sessionStatus = v.union(
  v.literal("active"),
  v.literal("awaiting_next"),
  v.literal("completed"),
  v.literal("abandoned"),
);

const optionValidator = v.object({
  key: v.string(),
  textEn: v.string(),
  textAm: v.string(),
});

const questionPayload = v.object({
  _id: v.id("questions"),
  chapter: v.string(),
  unit: v.string(),
  textEn: v.string(),
  textAm: v.string(),
  options: v.array(optionValidator),
  imageUrl: v.union(v.string(), v.null()),
});

function randomToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 8; i += 1) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function isOpenStatus(status: Doc<"chatSessions">["status"]): boolean {
  return status === "active" || status === "awaiting_next";
}

function isExpired(session: Doc<"chatSessions">, nowMs: number): boolean {
  return nowMs - session.lastQuestionAt > SESSION_TTL_MS;
}

async function uniqueToken(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const token = randomToken();
    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!existing) return token;
  }
  return `${randomToken()}${randomToken()}`.slice(0, 8);
}

async function listOpenSessions(ctx: QueryCtx | MutationCtx, telegramId: string) {
  const [active, awaitingNext] = await Promise.all([
    ctx.db
      .query("chatSessions")
      .withIndex("by_telegram_status_activity", (q) =>
        q.eq("telegramId", telegramId).eq("status", "active"),
      )
      .order("desc")
      .first(),
    ctx.db
      .query("chatSessions")
      .withIndex("by_telegram_status_activity", (q) =>
        q.eq("telegramId", telegramId).eq("status", "awaiting_next"),
      )
      .order("desc")
      .first(),
  ]);
  return [active, awaitingNext].filter(
    (row): row is Doc<"chatSessions"> => row !== null,
  );
}

async function abandonOpenSessions(ctx: MutationCtx, telegramId: string, nowMs: number) {
  const open = await listOpenSessions(ctx, telegramId);
  for (const session of open) {
    await ctx.db.patch(session._id, { status: "abandoned", lastQuestionAt: nowMs });
  }
}

async function getOwnedSession(
  ctx: MutationCtx,
  telegramId: string,
  token: string,
): Promise<Doc<"chatSessions"> | null> {
  const session = await ctx.db
    .query("chatSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.telegramId !== telegramId) return null;
  return session;
}

async function pickExamQuestions(
  ctx: MutationCtx,
  examId: Id<"exams">,
): Promise<Id<"questions">[]> {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_exam", (q) => q.eq("examId", examId))
    .collect();
  return questions.sort((a, b) => a.order - b.order).map((question) => question._id);
}

async function latestExamForTrack(ctx: MutationCtx, subjectSlug: string) {
  return await ctx.db
    .query("exams")
    .withIndex("by_subject_published", (q) =>
      q.eq("subjectSlug", subjectSlug).eq("isPublished", true),
    )
    .order("desc")
    .first();
}

function comboBonus(answers: Doc<"chatSessions">["answers"]): { bonusXp: number; maxCombo: number } {
  let combo = 0;
  let maxCombo = 0;
  let bonusXp = 0;
  for (const answer of answers) {
    if (answer.isCorrect) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      bonusXp += combo >= 5 ? 10 : combo >= 3 ? 5 : combo >= 2 ? 2 : 0;
    } else {
      combo = 0;
    }
  }
  return { bonusXp, maxCombo };
}

export const getActiveSession = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      token: v.string(),
      mode: sessionMode,
      status: sessionStatus,
      currentIndex: v.number(),
      total: v.number(),
      expired: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const open = await listOpenSessions(ctx, telegramId);
    const session = open.sort((a, b) => b.lastQuestionAt - a.lastQuestionAt)[0];
    if (!session) return null;
    return {
      token: session.token,
      mode: session.mode,
      status: session.status,
      currentIndex: session.currentIndex,
      total: session.questionIds.length,
      expired: isExpired(session, resolveNowMs(args.nowMs)),
    };
  },
});

export const startSession = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    mode: sessionMode,
    subjectSlug: v.optional(v.string()),
    examId: v.optional(v.id("exams")),
    source: v.optional(questionSourceValidator),
    force: v.optional(v.boolean()),
    dayIndex: v.optional(v.number()),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      token: v.string(),
      mode: sessionMode,
      examId: v.id("exams"),
      currentIndex: v.number(),
      total: v.number(),
      capped: v.boolean(),
      freeQuestionsLeft: v.number(),
      isPro: v.boolean(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(
        v.literal("quota"),
        v.literal("no_questions"),
        v.literal("no_subject"),
        v.literal("not_pro"),
        v.literal("active_session"),
        v.literal("user_not_found"),
      ),
      freeQuestionsLeft: v.optional(v.number()),
      existingToken: v.optional(v.string()),
      existingMode: v.optional(sessionMode),
      unmasteredCount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const now = Date.now();
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      return { ok: false as const, reason: "user_not_found" as const };
    }

    const subjectSlug = args.subjectSlug;
    if (!subjectSlug) {
      return { ok: false as const, reason: "no_subject" as const };
    }

    const open = await listOpenSessions(ctx, telegramId);
    const existing = open.sort((a, b) => b.lastQuestionAt - a.lastQuestionAt)[0];
    if (existing && !args.force && !isExpired(existing, now)) {
      return {
        ok: false as const,
        reason: "active_session" as const,
        existingToken: existing.token,
        existingMode: existing.mode,
      };
    }

    const isPro = isProActive(user, now);
    const questionsToday = await countQuestionsToday(ctx, user._id, utcDayStartMs(now), user);
    const freeQuestionsLeft = isPro ? 9999 : Math.max(0, FREE_DAILY_CAP - questionsToday);

    if (!isPro && freeQuestionsLeft <= 0 && args.mode !== "mistakes") {
      return { ok: false as const, reason: "quota" as const, freeQuestionsLeft: 0 };
    }

    let examId: Id<"exams"> | undefined = args.examId;
    let questionIds: Id<"questions">[] = [];
    let unmasteredCount = 0;

    if (args.mode === "mistakes") {
      if (!isPro) {
        const stats = await ctx.db
          .query("mistakeStats")
          .withIndex("by_user_subject", (q) =>
            q.eq("userId", user._id).eq("subjectSlug", subjectSlug),
          )
          .unique();
        return {
          ok: false as const,
          reason: "not_pro" as const,
          unmasteredCount: stats ? stats.totalCount - stats.masteredCount : 0,
        };
      }

      const mistakes = await ctx.db
        .query("mistakeBank")
        .withIndex("by_user_subject_mastered_time", (q) =>
          q
            .eq("userId", user._id)
            .eq("subjectSlug", subjectSlug)
            .eq("mastered", false),
        )
        .order("desc")
        .take(10);
      const stats = await ctx.db
        .query("mistakeStats")
        .withIndex("by_user_subject", (q) =>
          q.eq("userId", user._id).eq("subjectSlug", subjectSlug),
        )
        .unique();
      unmasteredCount = stats ? stats.totalCount - stats.masteredCount : mistakes.length;
      questionIds = mistakes.map((row) => row.questionId);

      const fallback = await latestExamForTrack(ctx, subjectSlug);
      examId = mistakes[0]?.examId ?? fallback?._id;
      if (!examId || questionIds.length === 0) {
        return {
          ok: false as const,
          reason: "no_questions" as const,
          unmasteredCount,
          freeQuestionsLeft,
        };
      }
    } else if (args.source || args.mode === "daily") {
      const source = args.source ?? (args.examId ? "past" : "mock");
      const questionCount =
        args.mode === "daily"
          ? clampDailyGoal(user.dailyGoal, isProActive(user))
          : undefined;
      let resolved = await resolveSourceQuestions(ctx, {
        subjectSlug,
        source,
        examId,
        mode: args.mode === "quick" ? "quick" : "exam",
        shuffle: true,
        questionCount,
      });
      if (!resolved && args.mode === "daily" && !args.source) {
        resolved = await resolveSourceQuestions(ctx, {
          subjectSlug,
          source: source === "mock" ? "past" : "mock",
          examId,
          mode: "exam",
          shuffle: true,
          questionCount,
        });
      }
      if (!resolved) {
        return { ok: false as const, reason: "no_questions" as const, freeQuestionsLeft };
      }
      examId = resolved.hostExam._id;
      questionIds = resolved.questions.map((question) => question._id);
    } else {
      const exam = examId
        ? await ctx.db.get(examId)
        : await latestExamForTrack(ctx, subjectSlug);
      if (!exam || !exam.isPublished) {
        return { ok: false as const, reason: "no_questions" as const, freeQuestionsLeft };
      }
      examId = exam._id;
      questionIds = await pickExamQuestions(ctx, exam._id);
      if (args.mode === "quick") {
        questionIds = questionIds.slice(0, 10);
      }
    }

    if (questionIds.length === 0) {
      return { ok: false as const, reason: "no_questions" as const, freeQuestionsLeft };
    }

    let capped = false;
    if (!isPro && questionIds.length > freeQuestionsLeft) {
      questionIds = questionIds.slice(0, freeQuestionsLeft);
      capped = true;
    }

    if (questionIds.length === 0) {
      return { ok: false as const, reason: "quota" as const, freeQuestionsLeft: 0 };
    }

    if (!examId) {
      return { ok: false as const, reason: "no_questions" as const, freeQuestionsLeft };
    }

    await abandonOpenSessions(ctx, telegramId, now);

    const token = await uniqueToken(ctx);
    await ctx.db.insert("chatSessions", {
      token,
      telegramId: telegramId,
      userId: user._id,
      mode: args.mode,
      examId,
      subjectSlug,
      questionIds,
      currentIndex: 0,
      answers: [],
      status: "active",
      startedAt: now,
      lastQuestionAt: now,
    });

    return {
      ok: true as const,
      token,
      mode: args.mode,
      examId,
      currentIndex: 0,
      total: questionIds.length,
      capped,
      freeQuestionsLeft,
      isPro,
    };
  },
});

export const getQuestionPayload = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      token: v.string(),
      mode: sessionMode,
      status: sessionStatus,
      currentIndex: v.number(),
      total: v.number(),
      question: questionPayload,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const session = await ctx.db
      .query("chatSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.telegramId !== telegramId) return null;
    if (!isOpenStatus(session.status)) return null;

    const questionId = session.questionIds[session.currentIndex];
    if (!questionId) return null;
    const question = await ctx.db.get(questionId);
    if (!question) return null;

    return {
      token: session.token,
      mode: session.mode,
      status: session.status,
      currentIndex: session.currentIndex,
      total: session.questionIds.length,
      question: {
        _id: question._id,
        chapter: question.chapter,
        unit: question.unit,
        textEn: question.textEn,
        textAm: question.textAm,
        options: question.options,
        imageUrl: question.imageId ? await ctx.storage.getUrl(question.imageId) : null,
      },
    };
  },
});

export const submitAnswer = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    selectedKey: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      isCorrect: v.boolean(),
      correctKey: v.string(),
      selectedKey: v.string(),
      explanationEn: v.string(),
      explanationAm: v.string(),
      currentIndex: v.number(),
      total: v.number(),
      isLast: v.boolean(),
      token: v.string(),
      textEn: v.string(),
      textAm: v.string(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(
        v.literal("not_found"),
        v.literal("not_active"),
        v.literal("expired"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const now = Date.now();
    const session = await getOwnedSession(ctx, telegramId, args.token);
    if (!session) return { ok: false as const, reason: "not_found" as const };
    if (isExpired(session, now)) {
      await ctx.db.patch(session._id, { status: "abandoned", lastQuestionAt: now });
      return { ok: false as const, reason: "expired" as const };
    }
    if (session.status !== "active") {
      return { ok: false as const, reason: "not_active" as const };
    }

    const questionId = session.questionIds[session.currentIndex];
    if (!questionId) return { ok: false as const, reason: "not_found" as const };
    const question = await ctx.db.get(questionId);
    if (!question) return { ok: false as const, reason: "not_found" as const };

    const isCorrect = question.correctKey === args.selectedKey;
    const timeSec = Math.max(1, Math.round((now - session.lastQuestionAt) / 1000));
    const answers = [
      ...session.answers,
      {
        questionId,
        selectedKey: args.selectedKey,
        timeSec,
        isCorrect,
      },
    ];

    await ctx.db.patch(session._id, {
      answers,
      status: "awaiting_next",
      lastQuestionAt: now,
    });

    const total = session.questionIds.length;
    return {
      ok: true as const,
      isCorrect,
      correctKey: question.correctKey,
      selectedKey: args.selectedKey,
      explanationEn: question.explanationEn,
      explanationAm: question.explanationAm,
      currentIndex: session.currentIndex,
      total,
      isLast: session.currentIndex >= total - 1,
      token: session.token,
      textEn: question.textEn,
      textAm: question.textAm,
    };
  },
});

export const advanceSession = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      done: v.boolean(),
      token: v.string(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("not_found"), v.literal("expired"), v.literal("wrong_state")),
    }),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const now = Date.now();
    const session = await getOwnedSession(ctx, telegramId, args.token);
    if (!session) return { ok: false as const, reason: "not_found" as const };
    if (isExpired(session, now)) {
      await ctx.db.patch(session._id, { status: "abandoned", lastQuestionAt: now });
      return { ok: false as const, reason: "expired" as const };
    }
    if (session.status !== "awaiting_next") {
      return { ok: false as const, reason: "wrong_state" as const };
    }

    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= session.questionIds.length) {
      return { ok: true as const, done: true, token: session.token };
    }

    await ctx.db.patch(session._id, {
      currentIndex: nextIndex,
      status: "active",
      lastQuestionAt: now,
    });
    return { ok: true as const, done: false, token: session.token };
  },
});

export const skipQuestion = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      done: v.boolean(),
      token: v.string(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("not_found"), v.literal("expired"), v.literal("wrong_state")),
    }),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const now = Date.now();
    const session = await getOwnedSession(ctx, telegramId, args.token);
    if (!session) return { ok: false as const, reason: "not_found" as const };
    if (isExpired(session, now)) {
      await ctx.db.patch(session._id, { status: "abandoned", lastQuestionAt: now });
      return { ok: false as const, reason: "expired" as const };
    }
    if (session.status !== "active") {
      return { ok: false as const, reason: "wrong_state" as const };
    }

    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= session.questionIds.length) {
      await ctx.db.patch(session._id, { lastQuestionAt: now, status: "awaiting_next" });
      return { ok: true as const, done: true, token: session.token };
    }

    await ctx.db.patch(session._id, {
      currentIndex: nextIndex,
      status: "active",
      lastQuestionAt: now,
    });
    return { ok: true as const, done: false, token: session.token };
  },
});

export const completeSession = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      empty: v.literal(true),
    }),
    v.object({
      ok: v.literal(true),
      empty: v.literal(false),
      attemptId: v.id("attempts"),
      score: v.number(),
      availableMarks: v.number(),
      correctCount: v.number(),
      totalQuestions: v.number(),
      xpGain: v.number(),
      bonusXp: v.number(),
      streakCount: v.number(),
      isPro: v.boolean(),
      mode: sessionMode,
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("not_found"), v.literal("already_done")),
    }),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const now = Date.now();
    const session = await getOwnedSession(ctx, telegramId, args.token);
    if (!session) return { ok: false as const, reason: "not_found" as const };
    if (!isOpenStatus(session.status)) {
      return { ok: false as const, reason: "already_done" as const };
    }

    if (session.answers.length === 0) {
      await ctx.db.patch(session._id, { status: "abandoned", lastQuestionAt: now });
      return { ok: true as const, empty: true as const };
    }

    const { bonusXp, maxCombo } = comboBonus(session.answers);
    const result = await gradeAndSaveAttempt(ctx, {
      telegramId: telegramId,
      examId: session.examId,
      mode: session.mode,
      answers: session.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedKey: answer.selectedKey,
        timeSec: answer.timeSec,
      })),
      durationSec: Math.max(1, Math.round((now - session.startedAt) / 1000)),
      bonusXp,
      maxCombo,
    });

    await ctx.db.patch(session._id, { status: "completed", lastQuestionAt: now });

    return {
      ok: true as const,
      empty: false as const,
      attemptId: result.attemptId,
      score: result.score,
      availableMarks: result.availableMarks,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      xpGain: result.xpGain,
      bonusXp: result.bonusXp,
      streakCount: result.streakCount,
      isPro: result.isPro,
      mode: session.mode,
    };
  },
});

export const abandonSession = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const now = Date.now();
    if (args.token) {
      const session = await getOwnedSession(ctx, telegramId, args.token);
      if (session && isOpenStatus(session.status)) {
        await ctx.db.patch(session._id, { status: "abandoned", lastQuestionAt: now });
      }
      return null;
    }
    await abandonOpenSessions(ctx, telegramId, now);
    return null;
  },
});

export const setIntent = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    kind: v.literal("pro_photo"),
    transactionRef: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const existing = await ctx.db
      .query("chatIntents")
      .withIndex("by_telegram", (q) => q.eq("telegramId", telegramId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.insert("chatIntents", {
      telegramId: telegramId,
      kind: args.kind,
      transactionRef: args.transactionRef,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const getIntent = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      kind: v.literal("pro_photo"),
      transactionRef: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const row = await ctx.db
      .query("chatIntents")
      .withIndex("by_telegram", (q) => q.eq("telegramId", telegramId))
      .order("desc")
      .first();
    if (!row) return null;
    return { kind: row.kind, transactionRef: row.transactionRef };
  },
});

export const clearIntent = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const rows = await ctx.db
      .query("chatIntents")
      .withIndex("by_telegram", (q) => q.eq("telegramId", telegramId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});
