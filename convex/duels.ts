import { v } from "convex/values";
import { resolveTelegramId } from "./lib/auth";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { calculateNewStreak } from "./streak";
import {
  collectQuestionsFromExams,
  listPublishedSubjectExamsForSource,
  questionSourceValidator,
  shuffleInPlace,
  timerSecForCount,
  type QuestionSource,
} from "./questionSource";
import { periodXpPatch } from "./period";
import { bumpUsageStats, nextDailyUsagePatch, quotaDateFor, storedDailyUsage } from "./quota";
import {
  DAILY_LIMIT_ERROR,
  FREE_DAILY_QUESTION_CAP,
  MAX_DUEL_PLAYERS,
  MAX_DUEL_QUESTIONS,
  MIN_DUEL_PLAYERS,
  MIN_DUEL_QUESTIONS,
  countQuestionsToday,
  isProActive,
  remainingFreeQuestions,
  utcDayStartMs,
} from "./exams";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function timerSecFor(questionCount: number): number {
  return timerSecForCount(questionCount);
}

function playerName(user: Doc<"users"> | null): string {
  return user?.firstName ?? user?.username ?? "Player";
}

/**
 * A duel must not touch the player's track (free accounts cannot change it,
 * so it would trap joiners from other tracks). The only profile field we
 * ever default is language, and only before the user has onboarded.
 */
async function defaultLanguageForNewUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  language: "en" | "am" | undefined,
) {
  if (!language || user.onboardingComplete || user.language === language) return;
  await ctx.db.patch(user._id, { language });
}

function maxSeats(duel: Doc<"duels">): number {
  return clamp(duel.maxPlayers ?? 2, MIN_DUEL_PLAYERS, MAX_DUEL_PLAYERS);
}

async function listSeats(ctx: QueryCtx | MutationCtx, duelId: Id<"duels">) {
  const seats = await ctx.db
    .query("duelPlayers")
    .withIndex("by_duel", (q) => q.eq("duelId", duelId))
    .collect();
  return seats.sort((a, b) => a.seat - b.seat);
}

function rankPlayers(seats: Doc<"duelPlayers">[]): Map<Id<"users">, number> {
  const finished = seats
    .filter((seat) => seat.score !== undefined)
    .sort((a, b) => {
      const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDelta !== 0) return scoreDelta;
      return (a.timeSec ?? 99999) - (b.timeSec ?? 99999);
    });
  const ranks = new Map<Id<"users">, number>();
  finished.forEach((seat, index) => {
    ranks.set(seat.userId, index + 1);
  });
  return ranks;
}

async function toPlayerViews(
  ctx: QueryCtx | MutationCtx,
  duel: Doc<"duels">,
  seats: Doc<"duelPlayers">[],
) {
  const ranks = rankPlayers(seats);
  return await Promise.all(
    seats.map(async (seat) => {
      const user = seat.playerName ? null : await ctx.db.get(seat.userId);
      return {
        id: seat.userId,
        name: seat.playerName ?? playerName(user),
        seat: seat.seat,
        isHost: seat.userId === duel.creatorId,
        hasFinished: seat.score !== undefined,
        score: seat.score,
        timeSec: seat.timeSec,
        rank: ranks.get(seat.userId),
      };
    }),
  );
}

async function ensureHostSeat(
  ctx: MutationCtx,
  duelId: Id<"duels">,
  user: Doc<"users">,
  now: number,
) {
  const existing = await ctx.db
    .query("duelPlayers")
    .withIndex("by_duel_and_user", (q) => q.eq("duelId", duelId).eq("userId", user._id))
    .unique();
  if (existing) return existing;
  return await ctx.db.insert("duelPlayers", {
    duelId,
    userId: user._id,
    seat: 0,
    playerName: playerName(user),
    joinedAt: now,
  });
}

export const getMyDuelStats = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    todayStartMs: v.optional(v.number()),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    totalDuels: v.number(),
    duelsToday: v.number(),
    questionsToday: v.number(),
    freeQuestionsLeft: v.number(),
    freeQuestionsMax: v.number(),
    freeDuelsLeft: v.number(),
    freeDuelsMax: v.number(),
    isPro: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      return {
        totalDuels: 0,
        duelsToday: 0,
        questionsToday: 0,
        freeQuestionsLeft: FREE_DAILY_QUESTION_CAP,
        freeQuestionsMax: FREE_DAILY_QUESTION_CAP,
        freeDuelsLeft: 0,
        freeDuelsMax: 0,
        isPro: false,
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
    const freeQuestionsLeft = isPro
      ? 9999
      : Math.max(0, FREE_DAILY_QUESTION_CAP - questionsToday);

    return {
      totalDuels: user.totalDuels ?? 0,
      duelsToday: stored?.duels ?? 0,
      questionsToday,
      freeQuestionsLeft,
      freeQuestionsMax: FREE_DAILY_QUESTION_CAP,
      freeDuelsLeft: isPro ? 9999 : freeQuestionsLeft >= MIN_DUEL_QUESTIONS ? 1 : 0,
      freeDuelsMax: 0,
      isPro,
    };
  },
});

const duelListItem = v.object({
  _id: v.id("duels"),
  code: v.string(),
  createdAt: v.number(),
  status: v.union(
    v.literal("waiting"),
    v.literal("active"),
    v.literal("completed"),
    v.literal("expired"),
  ),
  questionCount: v.number(),
  maxPlayers: v.number(),
  playerCount: v.number(),
  playerNames: v.array(v.string()),
  isCreator: v.boolean(),
  outcome: v.union(
    v.literal("won"),
    v.literal("lost"),
    v.literal("tied"),
    v.literal("waiting"),
    v.literal("pending_my_turn"),
  ),
});

export const listMyDuels = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    limit: v.optional(v.number()),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(duelListItem),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) return { items: [], hasMore: false };

    const limit = Math.max(1, Math.min(args.limit ?? 5, 30));
    const lookAhead = Math.max(limit + 8, 16);

    const created = await ctx.db
      .query("duels")
      .withIndex("by_creator_created", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .take(lookAhead);
    const seated = await ctx.db
      .query("duelPlayers")
      .withIndex("by_user_joined", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(lookAhead);

    const uniqueMap = new Map<Id<"duels">, Doc<"duels">>();
    for (const duel of created) uniqueMap.set(duel._id, duel);
    for (const seat of seated) {
      if (uniqueMap.has(seat.duelId)) continue;
      const duel = await ctx.db.get(seat.duelId);
      if (duel) uniqueMap.set(duel._id, duel);
    }

    const uniqueList = Array.from(uniqueMap.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );

    const hydrated = await Promise.all(
      uniqueList.map(async (duel) => {
        const seats = await listSeats(ctx, duel._id);
        const players = await toPlayerViews(ctx, duel, seats);
        const mine = seats.find((seat) => seat.userId === user._id);
        const questionCount = duel.questionIds.length;

        let outcome: "won" | "lost" | "tied" | "waiting" | "pending_my_turn" = "waiting";
        if (duel.status === "completed") {
          if (duel.winnerId === user._id) outcome = "won";
          else if (duel.winnerId) outcome = "lost";
          else outcome = "tied";
        } else if (!mine || mine.score === undefined) {
          outcome = "pending_my_turn";
        }

        return {
          _id: duel._id,
          code: duel.code,
          createdAt: duel.createdAt,
          status: duel.status,
          questionCount,
          maxPlayers: maxSeats(duel),
          playerCount: players.length,
          playerNames: players.map((player) => player.name),
          isCreator: user._id === duel.creatorId,
          outcome,
        };
      }),
    );

    const open = hydrated.filter(
      (duel) => duel.outcome === "pending_my_turn" || duel.outcome === "waiting",
    );
    const finished = hydrated.filter(
      (duel) => duel.outcome !== "pending_my_turn" && duel.outcome !== "waiting",
    );
    const page = [...open, ...finished.slice(0, limit)];
    return {
      items: page,
      hasMore: finished.length > limit,
    };
  },
});

export const createDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    subjectSlug: v.string(),
    questionCount: v.number(),
    maxPlayers: v.number(),
    source: v.optional(questionSourceValidator),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    duelId: v.id("duels"),
    code: v.string(),
    questionCount: v.number(),
    maxPlayers: v.number(),
    timerSec: v.number(),
  }),
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

    const now = Date.now();
    const isPro = isProActive(user, now);
    const seats = clamp(args.maxPlayers, MIN_DUEL_PLAYERS, MAX_DUEL_PLAYERS);
    let wanted = clamp(args.questionCount, MIN_DUEL_QUESTIONS, MAX_DUEL_QUESTIONS);

    if (!isPro) {
      const remainingToday = await remainingFreeQuestions(ctx, user._id, utcDayStartMs(now), user);
      if (remainingToday < MIN_DUEL_QUESTIONS) {
        throw new Error(DAILY_LIMIT_ERROR);
      }
      wanted = Math.min(wanted, remainingToday, FREE_DAILY_QUESTION_CAP);
    }

    const source: QuestionSource = args.source ?? "mock";
    const publishedExams = await listPublishedSubjectExamsForSource(
      ctx,
      args.subjectSlug,
      source,
    );
    if (!publishedExams.length) {
      throw new Error(
        source === "mock"
          ? "No mock exam questions found for this subject"
          : "No past exams found for this subject",
      );
    }

    const allQuestions = await collectQuestionsFromExams(
      ctx,
      shuffleInPlace([...publishedExams]),
      wanted,
    );

    if (allQuestions.length < MIN_DUEL_QUESTIONS) {
      throw new Error("Not enough questions in this subject for a Duel");
    }

    const selected = shuffleInPlace([...allQuestions]).slice(
      0,
      Math.min(wanted, allQuestions.length),
    );
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const duelId = await ctx.db.insert("duels", {
      code,
      creatorId: user._id,
      subjectSlug: args.subjectSlug,
      questionIds: selected.map((question) => question._id),
      status: "waiting",
      createdAt: now,
      maxPlayers: seats,
      playerCount: 1,
    });
    await ensureHostSeat(ctx, duelId, user, now);
    await ctx.db.patch(user._id, { totalDuels: (user.totalDuels ?? 0) + 1 });

    return {
      duelId,
      code,
      questionCount: selected.length,
      maxPlayers: seats,
      timerSec: timerSecFor(selected.length),
    };
  },
});

export const joinDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    language: v.optional(v.union(v.literal("en"), v.literal("am"))),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    joined: v.boolean(),
    seat: v.number(),
  }),
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

    const duel = await ctx.db
      .query("duels")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!duel) throw new Error("Duel not found");
    if (duel.status === "completed" || duel.status === "expired") {
      throw new Error("This Duel is already closed");
    }

    // A duel draws its own paper, so it must never overwrite the player's
    // track. Doing so pinned new joiners from other tracks into an
    // unchangeable (free plan) track. Only default the language for users
    // who have not onboarded yet; onboarded users keep their choice.
    await defaultLanguageForNewUser(ctx, user, args.language);

    const existing = await ctx.db
      .query("duelPlayers")
      .withIndex("by_duel_and_user", (q) => q.eq("duelId", duel._id).eq("userId", user._id))
      .unique();
    if (existing) {
      return { joined: true, seat: existing.seat };
    }

    const seats = await listSeats(ctx, duel._id);
    if (seats.length >= maxSeats(duel)) {
      throw new Error("This Duel lobby is full");
    }

    const now = Date.now();
    if (!isProActive(user, now)) {
      const remainingToday = await remainingFreeQuestions(ctx, user._id, utcDayStartMs(now), user);
      if (remainingToday < duel.questionIds.length) {
        throw new Error(DAILY_LIMIT_ERROR);
      }
    }

    const seat = seats.length;
    await ctx.db.insert("duelPlayers", {
      duelId: duel._id,
      userId: user._id,
      seat,
      playerName: playerName(user),
      joinedAt: now,
    });
    await ctx.db.patch(user._id, { totalDuels: (user.totalDuels ?? 0) + 1 });

    if (duel.status === "waiting" && seats.length + 1 >= 2) {
      await ctx.db.patch(duel._id, { status: "active", playerCount: seats.length + 1 });
    } else {
      await ctx.db.patch(duel._id, { playerCount: seats.length + 1 });
    }

    return { joined: true, seat };
  },
});

export const getDuel = query({
  args: {
    code: v.string(),
    telegramId: v.optional(v.string()),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const duel = await ctx.db
      .query("duels")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();

    if (!duel) return null;

    const caller = args.telegramId
      ? await ctx.db
          .query("users")
          .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId!))
          .unique()
      : null;

    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", duel.subjectSlug))
      .unique();

    const seats = await listSeats(ctx, duel._id);
    if (seats.length === 0) {
      const host = await ctx.db.get(duel.creatorId);
      const opponent = duel.opponentId ? await ctx.db.get(duel.opponentId) : null;
      const synthesized = [
        {
          id: duel.creatorId,
          name: playerName(host),
          seat: 0,
          isHost: true,
          hasFinished: duel.creatorScore !== undefined,
          score: duel.creatorScore,
          timeSec: duel.creatorTimeSec,
          rank: undefined as number | undefined,
        },
      ];
      if (opponent) {
        synthesized.push({
          id: opponent._id,
          name: playerName(opponent),
          seat: 1,
          isHost: false,
          hasFinished: duel.opponentScore !== undefined,
          score: duel.opponentScore,
          timeSec: duel.opponentTimeSec,
          rank: undefined,
        });
      }
      const questionCount = duel.questionIds.length;
      return {
        _id: duel._id,
        code: duel.code,
        status: duel.status,
        subjectName: subject?.nameEn ?? duel.subjectSlug,
        subjectSlug: duel.subjectSlug,
        questionCount,
        maxPlayers: maxSeats(duel),
        timerSec: timerSecFor(questionCount),
        players: synthesized,
        winnerId: duel.winnerId,
        winnerName: synthesized.find((player) => player.id === duel.winnerId)?.name ?? null,
        callerId: caller?._id ?? null,
        isCreator: caller ? caller._id === duel.creatorId : false,
        isPlayer: caller
          ? caller._id === duel.creatorId || caller._id === duel.opponentId
          : false,
        hasCallerPlayed: caller
          ? caller._id === duel.creatorId
            ? duel.creatorScore !== undefined
            : caller._id === duel.opponentId
              ? duel.opponentScore !== undefined
              : false
          : false,
        isFull: synthesized.length >= maxSeats(duel),
        createdAt: duel.createdAt,
        completedAt: duel.completedAt,
      };
    }

    const players = await toPlayerViews(ctx, duel, seats);
    const mine = caller ? seats.find((seat) => seat.userId === caller._id) : null;
    const questionCount = duel.questionIds.length;

    return {
      _id: duel._id,
      code: duel.code,
      status: duel.status,
      subjectName: subject?.nameEn ?? duel.subjectSlug,
      subjectSlug: duel.subjectSlug,
      questionCount,
      maxPlayers: maxSeats(duel),
      timerSec: timerSecFor(questionCount),
      players,
      winnerId: duel.winnerId,
      winnerName: players.find((player) => player.id === duel.winnerId)?.name ?? null,
      callerId: caller?._id ?? null,
      isCreator: caller ? caller._id === duel.creatorId : false,
      isPlayer: Boolean(mine),
      hasCallerPlayed: mine?.score !== undefined,
      isFull: players.length >= maxSeats(duel),
      createdAt: duel.createdAt,
      completedAt: duel.completedAt,
    };
  },
});

export const getDuelQuestions = query({
  args: {
    code: v.string(),
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const duel = await ctx.db
      .query("duels")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!duel) return null;

    const caller = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!caller) return null;

    const seat = await ctx.db
      .query("duelPlayers")
      .withIndex("by_duel_and_user", (q) =>
        q.eq("duelId", duel._id).eq("userId", caller._id),
      )
      .unique();
    const isLegacyPlayer =
      caller._id === duel.creatorId || caller._id === duel.opponentId;
    if (!seat && !isLegacyPlayer) return { questions: [] };

    return { questions: await loadQuestions(ctx, duel.questionIds) };
  },
});

async function loadQuestions(
  ctx: QueryCtx | MutationCtx,
  questionIds: Id<"questions">[],
) {
  return (
    await Promise.all(
      questionIds.map(async (qid, idx) => {
        const q = await ctx.db.get(qid);
        if (!q) return null;
        return {
          _id: q._id,
          order: idx + 1,
          unit: q.unit,
          chapter: q.chapter,
          textEn: q.textEn,
          textAm: q.textAm,
          options: q.options,
          correctKey: q.correctKey,
          explanationEn: q.explanationEn,
          explanationAm: q.explanationAm,
          imageUrl: q.imageId ? await ctx.storage.getUrl(q.imageId) : null,
        };
      }),
    )
  ).filter((q): q is NonNullable<typeof q> => q !== null);
}

export const submitDuelAttempt = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedKey: v.string(),
        timeSec: v.number(),
      }),
    ),
    durationSec: v.number(),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    score: v.number(),
    total: v.number(),
    durationSec: v.number(),
    isCompleted: v.boolean(),
    rank: v.optional(v.number()),
  }),
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

    const duel = await ctx.db
      .query("duels")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!duel) throw new Error("Duel not found");
    if (duel.status === "completed" || duel.status === "expired") {
      throw new Error("This Duel is already closed");
    }

    const now = Date.now();
    let seat = await ctx.db
      .query("duelPlayers")
      .withIndex("by_duel_and_user", (q) => q.eq("duelId", duel._id).eq("userId", user._id))
      .unique();

    if (!seat) {
      const seats = await listSeats(ctx, duel._id);
      if (seats.length >= maxSeats(duel)) {
        throw new Error("This Duel lobby is full");
      }
      const seatId = await ctx.db.insert("duelPlayers", {
        duelId: duel._id,
        userId: user._id,
        seat: seats.length,
        playerName: playerName(user),
        joinedAt: now,
      });
      await ctx.db.patch(duel._id, { playerCount: seats.length + 1 });
      seat = await ctx.db.get(seatId);
    }

    if (!seat) throw new Error("Could not join this Duel");
    if (seat.score !== undefined) {
      const seats = await listSeats(ctx, duel._id);
      return {
        score: seat.score,
        total: duel.questionIds.length,
        durationSec: seat.timeSec ?? args.durationSec,
        isCompleted: seats.length >= 2 && seats.every((row) => row.score !== undefined),
        rank: rankPlayers(seats).get(user._id),
      };
    }

    if (!isProActive(user, now)) {
      const remainingToday = await remainingFreeQuestions(ctx, user._id, utcDayStartMs(now), user);
      if (remainingToday < duel.questionIds.length) {
        throw new Error(DAILY_LIMIT_ERROR);
      }
    }

    let score = 0;
    const graded = [];
    const questionRows = await Promise.all(
      duel.questionIds.map(async (questionId) => await ctx.db.get(questionId)),
    );
    const questionsById = new Map(
      questionRows
        .filter((question): question is Doc<"questions"> => question !== null)
        .map((question) => [question._id, question]),
    );
    for (const answer of args.answers) {
      const question = questionsById.get(answer.questionId);
      if (!question) continue;
      const isCorrect = question.correctKey === answer.selectedKey;
      if (isCorrect) score += 1;
      graded.push({
        questionId: answer.questionId,
        selectedKey: answer.selectedKey,
        isCorrect,
      });
    }

    await ctx.db.patch(seat._id, {
      score,
      timeSec: args.durationSec,
      answers: graded,
      playedAt: now,
    });

    const streakResult = calculateNewStreak(
      {
        streakCount: user.streakCount,
        lastPracticeDate: user.lastPracticeDate,
        lastPracticeAt: user.lastPracticeAt,
      },
      now,
    );
    await ctx.db.patch(user._id, {
      lastActiveAt: now,
      lastPracticeAt: streakResult.lastPracticeAt,
      lastPracticeDate: streakResult.lastPracticeDate,
      streakCount: streakResult.streakCount,
      ...nextDailyUsagePatch(user, now, {
        questions: duel.questionIds.length,
        duels: 1,
        label: "Duel",
      }),
    });

    const seats = await listSeats(ctx, duel._id);
    const allFinished = seats.length >= 2 && seats.every((row) => row.score !== undefined);
    let isCompleted = false;
    let winnerId: Id<"users"> | undefined;

    if (allFinished) {
      const ranks = rankPlayers(seats);
      const first = seats.find((row) => ranks.get(row.userId) === 1);
      const topScore = first?.score;
      const tied = seats.filter((row) => row.score === topScore);
      winnerId = tied.length === 1 ? first?.userId : undefined;
      await ctx.db.patch(duel._id, {
        status: "completed",
        completedAt: now,
        winnerId,
      });
      if (winnerId) {
        const winner = await ctx.db.get(winnerId);
        if (winner) {
          await ctx.db.patch(winner._id, {
            xp: winner.xp + 50,
            ...periodXpPatch(winner, now, 50),
          });
          await bumpUsageStats(ctx, String(winner._id), { totalXp: 50 });
        }
      }
      isCompleted = true;
    } else if (duel.status === "waiting") {
      await ctx.db.patch(duel._id, { status: "active" });
    }

    return {
      score,
      total: duel.questionIds.length,
      durationSec: args.durationSec,
      isCompleted,
      rank: rankPlayers(seats).get(user._id),
    };
  },
});
