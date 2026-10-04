import { v } from "convex/values";
import { resolveTelegramId } from "./lib/auth";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { calculateNewStreak } from "./streak";
import { periodXpPatch } from "./period";
import { nextDailyUsagePatch, bumpUsageStats } from "./quota";
import {
  collectQuestionsFromExams,
  shuffleInPlace,
} from "./questionSource";
import {
  DAILY_LIMIT_ERROR,
  MAX_DUEL_PLAYERS,
  MAX_DUEL_QUESTIONS,
  MIN_DUEL_PLAYERS,
  MIN_DUEL_QUESTIONS,
  isProActive,
  remainingFreeQuestions,
  utcDayStartMs,
} from "./exams";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const groupDuelStatus = v.union(
  v.literal("waiting"),
  v.literal("question"),
  v.literal("reveal"),
  v.literal("completed"),
  v.literal("cancelled"),
);

const langValidator = v.union(v.literal("en"), v.literal("am"));

const chatArg = { chatId: v.optional(v.number()) };

const playerView = v.object({
  userId: v.id("users"),
  name: v.string(),
  score: v.number(),
  totalTimeMs: v.number(),
  isHost: v.boolean(),
});

const duelView = v.object({
  _id: v.id("groupDuels"),
  code: v.string(),
  status: groupDuelStatus,
  subjectSlug: v.string(),
  questionCount: v.number(),
  maxPlayers: v.number(),
  playerCount: v.number(),
  players: v.array(playerView),
  isFull: v.boolean(),
  isCreator: v.boolean(),
  isPlayer: v.boolean(),
  winnerName: v.union(v.string(), v.null()),
  lang: langValidator,
});

const scoreView = v.object({ name: v.string(), score: v.number() });

const roundView = v.object({
  code: v.string(),
  status: groupDuelStatus,
  index: v.number(),
  questionCount: v.number(),
  subjectSlug: v.string(),
  lang: langValidator,
  questionText: v.union(v.string(), v.null()),
  options: v.array(v.object({ key: v.string(), text: v.string() })),
  correctKey: v.union(v.string(), v.null()),
  explanation: v.union(v.string(), v.null()),
  scores: v.array(scoreView),
  roundWinnerName: v.union(v.string(), v.null()),
  winnerName: v.union(v.string(), v.null()),
  isCreator: v.boolean(),
});

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

async function uniqueToken(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const token = randomCode(8);
    const existing = await ctx.db
      .query("groupDuelSetups")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!existing) return token;
  }
  return `${randomCode(8)}${Date.now().toString(36)}`.slice(0, 16);
}

async function uniqueDuelCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode(6);
    const existing = await ctx.db
      .query("groupDuels")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!existing) return code;
  }
  return randomCode(8);
}

function playerName(user: Doc<"users"> | null | undefined): string {
  return user?.firstName ?? user?.username ?? "Player";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

async function listPlayers(
  ctx: QueryCtx | MutationCtx,
  duelId: Id<"groupDuels">,
): Promise<Doc<"groupDuelPlayers">[]> {
  const rows = await ctx.db
    .query("groupDuelPlayers")
    .withIndex("by_duel", (q) => q.eq("duelId", duelId))
    .collect();
  return rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalTimeMs - b.totalTimeMs;
  });
}

function toScoreView(players: Doc<"groupDuelPlayers">[]): Array<{ name: string; score: number }> {
  return [...players]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.totalTimeMs - b.totalTimeMs;
    })
    .map((player) => ({ name: player.name, score: player.score }));
}

async function duelToView(
  ctx: QueryCtx | MutationCtx,
  duel: Doc<"groupDuels">,
  callerId: Id<"users"> | null,
): Promise<{
  _id: Id<"groupDuels">;
  code: string;
  status: Doc<"groupDuels">["status"];
  subjectSlug: string;
  questionCount: number;
  maxPlayers: number;
  playerCount: number;
  players: Array<{
    userId: Id<"users">;
    name: string;
    score: number;
    totalTimeMs: number;
    isHost: boolean;
  }>;
  isFull: boolean;
  isCreator: boolean;
  isPlayer: boolean;
  winnerName: string | null;
  lang: "en" | "am";
}> {
  const players = await listPlayers(ctx, duel._id);
  const winner =
    duel.status === "completed" && duel.winnerId
      ? players.find((player) => player.userId === duel.winnerId)?.name ?? null
      : null;
  return {
    _id: duel._id,
    code: duel.code,
    status: duel.status,
    subjectSlug: duel.subjectSlug,
    questionCount: duel.questionCount,
    maxPlayers: duel.maxPlayers,
    playerCount: players.length,
    players: players.map((player) => ({
      userId: player.userId,
      name: player.name,
      score: player.score,
      totalTimeMs: player.totalTimeMs,
      isHost: player.userId === duel.creatorId,
    })),
    isFull: players.length >= duel.maxPlayers,
    isCreator: callerId === duel.creatorId,
    isPlayer: callerId !== null && players.some((player) => player.userId === callerId),
    winnerName: winner,
    lang: duel.lang,
  };
}

async function roundToView(
  ctx: QueryCtx | MutationCtx,
  duel: Doc<"groupDuels">,
  callerId: Id<"users"> | null,
  roundWinnerName: string | null,
): Promise<{
  code: string;
  status: Doc<"groupDuels">["status"];
  index: number;
  questionCount: number;
  subjectSlug: string;
  lang: "en" | "am";
  questionText: string | null;
  options: Array<{ key: string; text: string }>;
  correctKey: string | null;
  explanation: string | null;
  scores: Array<{ name: string; score: number }>;
  roundWinnerName: string | null;
  winnerName: string | null;
  isCreator: boolean;
}> {
  const players = await listPlayers(ctx, duel._id);
  const lang = duel.lang;
  const reveal = duel.status === "reveal" || duel.status === "completed";
  const questionId = duel.questionIds[duel.currentIndex];
  const question = questionId ? await ctx.db.get(questionId) : null;
  const winnerName =
    duel.status === "completed" && duel.winnerId
      ? players.find((player) => player.userId === duel.winnerId)?.name ?? null
      : null;

  return {
    code: duel.code,
    status: duel.status,
    index: duel.currentIndex,
    questionCount: duel.questionCount,
    subjectSlug: duel.subjectSlug,
    lang,
    questionText: question ? (lang === "am" ? question.textAm : question.textEn) : null,
    options: question
      ? question.options.map((option) => ({
          key: option.key,
          text: lang === "am" ? option.textAm : option.textEn,
        }))
      : [],
    correctKey: reveal ? question?.correctKey ?? null : null,
    explanation: reveal
      ? question
        ? lang === "am"
          ? question.explanationAm
          : question.explanationEn
        : null
      : null,
    scores: toScoreView(players),
    roundWinnerName,
    winnerName,
    isCreator: callerId === duel.creatorId,
  };
}

async function resolveTrack(ctx: MutationCtx, slug: string) {
  const track = await ctx.db
    .query("tracks")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!track) throw new Error("Track not found");
  return track;
}

async function resolveSubject(ctx: MutationCtx, slug: string) {
  const subject = await ctx.db
    .query("subjects")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!subject) throw new Error("Subject not found");
  if (!subject.isPublished) throw new Error("Subject is not published");
  return subject;
}

async function resolveDuelQuestions(
  ctx: MutationCtx,
  subjectSlug: string,
  count: number,
): Promise<Doc<"questions">[] | null> {
  // Pull from every published exam in the subject (mock + past), then pick
  // random questions. Questions are read across shuffled exams and re-shuffled
  // so a single exam can't dominate a round.
  const exams = await ctx.db
    .query("exams")
    .withIndex("by_subject_published", (q) =>
      q.eq("subjectSlug", subjectSlug).eq("isPublished", true),
    )
    .collect();
  if (!exams.length) return null;

  const poolCap = Math.min(Math.max(count * 6, 60), 240);
  const pool = await collectQuestionsFromExams(ctx, shuffleInPlace([...exams]), poolCap);
  if (!pool.length) return null;
  return shuffleInPlace([...pool]).slice(0, count);
}

async function loadSetup(ctx: MutationCtx, token: string, telegramId: string) {
  const setup = await ctx.db
    .query("groupDuelSetups")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!setup || setup.status !== "active") throw new Error("This duel setup has expired");
  if (setup.ownerTelegramId !== telegramId) throw new Error("Only the host can set this up");
  return setup;
}

async function findDuel(ctx: MutationCtx | QueryCtx, code: string) {
  return await ctx.db
    .query("groupDuels")
    .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
    .unique();
}

/** A group duel may only be driven from the chat it was created in. */
function assertSameChat(duel: Doc<"groupDuels">, chatId: number | undefined) {
  if (chatId === undefined || chatId === 0 || duel.chatId === 0) return;
  if (duel.chatId !== chatId) throw new Error("Duel not found");
}

async function callerUser(
  ctx: MutationCtx | QueryCtx,
  args: { telegramId: string; initData?: string; botProof?: string },
) {
  const telegramId = await resolveTelegramId(args);
  const user = await ctx.db
    .query("users")
    .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
    .unique();
  if (user?.isBanned) {
    throw new Error(
      "ACCOUNT_BANNED: This account has been suspended. Contact support if you think this is a mistake.",
    );
  }
  return { telegramId, user };
}

async function chargePlayer(
  ctx: MutationCtx,
  player: Doc<"groupDuelPlayers">,
  questionCount: number,
  now: number,
) {
  const user = await ctx.db.get(player.userId);
  if (!user) return;
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
    totalDuels: (user.totalDuels ?? 0) + 1,
    ...nextDailyUsagePatch(user, now, {
      questions: questionCount,
      duels: 1,
      label: "Duel",
    }),
  });
}

export const createSetup = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    chatId: v.number(),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    const { telegramId, user } = await callerUser(ctx, args);
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("groupDuelSetups")
      .withIndex("by_chat_owner", (q) =>
        q.eq("chatId", args.chatId).eq("ownerTelegramId", telegramId),
      )
      .collect();
    for (const row of existing) {
      if (row.status === "active") await ctx.db.patch(row._id, { status: "done" });
    }

    const token = await uniqueToken(ctx);
    await ctx.db.insert("groupDuelSetups", {
      token,
      chatId: args.chatId,
      ownerTelegramId: telegramId,
      ownerUserId: user._id,
      status: "active",
      createdAt: Date.now(),
    });
    return { token };
  },
});

export const getSetup = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      ownerTelegramId: v.string(),
      subjectSlug: v.union(v.string(), v.null()),
      questionCount: v.union(v.number(), v.null()),
      maxPlayers: v.union(v.number(), v.null()),
      status: v.union(v.literal("active"), v.literal("done")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const setup = await ctx.db
      .query("groupDuelSetups")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!setup) return null;
    return {
      ownerTelegramId: setup.ownerTelegramId,
      subjectSlug: setup.subjectSlug ?? null,
      questionCount: setup.questionCount ?? null,
      maxPlayers: setup.maxPlayers ?? null,
      status: setup.status,
    };
  },
});

export const setSetupSubject = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    subjectSlug: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { telegramId } = await callerUser(ctx, args);
    const setup = await loadSetup(ctx, args.token, telegramId);
    const subject = await resolveSubject(ctx, args.subjectSlug);
    await ctx.db.patch(setup._id, { subjectSlug: subject.slug });
    return null;
  },
});

export const setSetupQuestions = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    questionCount: v.number(),
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { telegramId } = await callerUser(ctx, args);
    const setup = await loadSetup(ctx, args.token, telegramId);
    const count = clamp(args.questionCount, MIN_DUEL_QUESTIONS, MAX_DUEL_QUESTIONS);
    await ctx.db.patch(setup._id, { questionCount: count });
    return null;
  },
});

export const setSetupPlayers = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    maxPlayers: v.number(),
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { telegramId } = await callerUser(ctx, args);
    const setup = await loadSetup(ctx, args.token, telegramId);
    const seats = clamp(args.maxPlayers, MIN_DUEL_PLAYERS, MAX_DUEL_PLAYERS);
    await ctx.db.patch(setup._id, { maxPlayers: seats });
    return null;
  },
});

export const cancelSetup = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { telegramId } = await callerUser(ctx, args);
    const setup = await ctx.db
      .query("groupDuelSetups")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!setup || setup.ownerTelegramId !== telegramId) return null;
    if (setup.status === "active") await ctx.db.patch(setup._id, { status: "done" });
    return null;
  },
});

export const createGroupDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    token: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(duelView, v.null()),
  handler: async (ctx, args) => {
    const { telegramId } = await callerUser(ctx, args);
    const setup = await loadSetup(ctx, args.token, telegramId);
    const subjectSlug = setup.subjectSlug;
    const questionCount = setup.questionCount;
    const maxPlayers = setup.maxPlayers;
    if (!subjectSlug || !questionCount || !maxPlayers) {
      throw new Error("Pick a subject, question count and players first");
    }

    const questions = await resolveDuelQuestions(ctx, subjectSlug, questionCount);
    if (!questions || questions.length < MIN_DUEL_QUESTIONS) {
      throw new Error("Not enough published questions for this subject");
    }

    const now = Date.now();
    const creator = await ctx.db.get(setup.ownerUserId);
    if (!creator) throw new Error("User not found");
    if (!isProActive(creator, now)) {
      const remaining = await remainingFreeQuestions(ctx, creator._id, utcDayStartMs(now), creator);
      if (remaining < questions.length) throw new Error(DAILY_LIMIT_ERROR);
    }

    const code = await uniqueDuelCode(ctx);
    const duelId = await ctx.db.insert("groupDuels", {
      code,
      chatId: setup.chatId,
      creatorId: creator._id,
      creatorTelegramId: creator.telegramId,
      subjectSlug,
      lang: creator.language === "am" ? "am" : "en",
      questionIds: questions.map((question) => question._id),
      questionCount: questions.length,
      maxPlayers,
      status: "waiting",
      currentIndex: 0,
      roundStartedAt: now,
      createdAt: now,
    });

    await ctx.db.insert("groupDuelPlayers", {
      duelId,
      userId: creator._id,
      telegramId: creator.telegramId,
      name: playerName(creator),
      score: 0,
      totalTimeMs: 0,
      joinedAt: now,
      answers: [],
    });

    await ctx.db.patch(setup._id, { status: "done" });

    const duel = await ctx.db.get(duelId);
    if (!duel) return null;
    return await duelToView(ctx, duel, creator._id);
  },
});

export const getGroupDuel = query({
  args: {
    code: v.string(),
    telegramId: v.optional(v.string()),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(duelView, v.null()),
  handler: async (ctx, args) => {
    const duel = await findDuel(ctx, args.code);
    if (!duel) return null;
    let callerId: Id<"users"> | null = null;
    if (args.telegramId) {
      const caller = await ctx.db
        .query("users")
        .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId!))
        .unique();
      callerId = caller?._id ?? null;
    }
    return await duelToView(ctx, duel, callerId);
  },
});

export const joinGroupDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    ...chatArg,
    nowMs: v.optional(v.number()),
  },
  returns: duelView,
  handler: async (ctx, args) => {
    const { user } = await callerUser(ctx, args);
    if (!user) throw new Error("User not found");
    const duel = await findDuel(ctx, args.code);
    if (!duel) throw new Error("Duel not found");
    assertSameChat(duel, args.chatId);
    if (duel.status !== "waiting") throw new Error("This duel has already started");
    if (duel.chatId === 0) throw new Error("Duel not found");

    const players = await listPlayers(ctx, duel._id);
    if (players.some((player) => player.userId === user._id)) {
      return await duelToView(ctx, duel, user._id);
    }
    if (players.length >= duel.maxPlayers) throw new Error("This duel is full");

    const now = Date.now();
    if (!isProActive(user, now)) {
      const remaining = await remainingFreeQuestions(ctx, user._id, utcDayStartMs(now), user);
      if (remaining < duel.questionCount) throw new Error(DAILY_LIMIT_ERROR);
    }

    await ctx.db.insert("groupDuelPlayers", {
      duelId: duel._id,
      userId: user._id,
      telegramId: user.telegramId,
      name: playerName(user),
      score: 0,
      totalTimeMs: 0,
      joinedAt: now,
      answers: [],
    });

    return await duelToView(ctx, duel, user._id);
  },
});

export const startGroupDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    ...chatArg,
    nowMs: v.optional(v.number()),
  },
  returns: roundView,
  handler: async (ctx, args) => {
    const { telegramId, user } = await callerUser(ctx, args);
    if (!user) throw new Error("User not found");
    const duel = await findDuel(ctx, args.code);
    if (!duel) throw new Error("Duel not found");
    assertSameChat(duel, args.chatId);
    if (duel.creatorTelegramId !== telegramId) throw new Error("Only the host can start");
    if (duel.status !== "waiting") throw new Error("This duel has already started");

    const players = await listPlayers(ctx, duel._id);
    if (players.length < MIN_DUEL_PLAYERS) throw new Error("Need at least 2 players");

    const now = Date.now();
    await ctx.db.patch(duel._id, {
      status: "question",
      currentIndex: 0,
      roundStartedAt: now,
      startedAt: now,
    });
    for (const player of players) {
      await chargePlayer(ctx, player, duel.questionCount, now);
    }

    const updated = await ctx.db.get(duel._id);
    if (!updated) throw new Error("Duel not found");
    return await roundToView(ctx, updated, user._id, null);
  },
});

export const answerGroupDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    index: v.number(),
    key: v.string(),
    ...chatArg,
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    outcome: v.union(
      v.literal("correct"),
      v.literal("wrong"),
      v.literal("locked"),
      v.literal("ignored"),
      v.literal("not_player"),
    ),
    round: roundView,
  }),
  handler: async (ctx, args) => {
    const { user } = await callerUser(ctx, args);
    const duel = await findDuel(ctx, args.code);
    if (!duel || !user) throw new Error("Duel not found");
    assertSameChat(duel, args.chatId);

    const players = await listPlayers(ctx, duel._id);
    const player = players.find((row) => row.userId === user._id);
    if (!player) {
      return { outcome: "not_player" as const, round: await roundToView(ctx, duel, user._id, null) };
    }

    if (duel.status !== "question" || args.index !== duel.currentIndex) {
      return {
        outcome: "ignored" as const,
        round: await roundToView(ctx, duel, user._id, null),
      };
    }

    if (player.lockedIndex === args.index) {
      return {
        outcome: "locked" as const,
        round: await roundToView(ctx, duel, user._id, null),
      };
    }

    const questionId = duel.questionIds[args.index];
    const question = questionId ? await ctx.db.get(questionId) : null;
    if (!question) throw new Error("Question not found");

    const now = Date.now();
    const timeMs = Math.max(0, now - duel.roundStartedAt);
    const isCorrect = question.correctKey === args.key;

    if (!isCorrect) {
      await ctx.db.patch(player._id, {
        lockedIndex: args.index,
        answers: [
          ...player.answers,
          { index: args.index, selectedKey: args.key, isCorrect: false, timeMs },
        ],
      });
      return {
        outcome: "wrong" as const,
        round: await roundToView(ctx, duel, user._id, null),
      };
    }

    await ctx.db.patch(player._id, {
      score: player.score + 1,
      totalTimeMs: player.totalTimeMs + timeMs,
      answers: [
        ...player.answers,
        { index: args.index, selectedKey: args.key, isCorrect: true, timeMs },
      ],
    });
    await ctx.db.patch(duel._id, { status: "reveal" });

    const updated = await ctx.db.get(duel._id);
    if (!updated) throw new Error("Duel not found");
    return {
      outcome: "correct" as const,
      round: await roundToView(ctx, updated, user._id, player.name),
    };
  },
});

export const revealGroupDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    ...chatArg,
    nowMs: v.optional(v.number()),
  },
  returns: roundView,
  handler: async (ctx, args) => {
    const { telegramId, user } = await callerUser(ctx, args);
    if (!user) throw new Error("User not found");
    const duel = await findDuel(ctx, args.code);
    if (!duel) throw new Error("Duel not found");
    assertSameChat(duel, args.chatId);
    if (duel.creatorTelegramId !== telegramId) throw new Error("Only the host can continue");
    if (duel.status === "question") {
      await ctx.db.patch(duel._id, { status: "reveal" });
    }
    const updated = await ctx.db.get(duel._id);
    if (!updated) throw new Error("Duel not found");
    return await roundToView(ctx, updated, user._id, null);
  },
});

export const advanceGroupDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    ...chatArg,
    nowMs: v.optional(v.number()),
  },
  returns: roundView,
  handler: async (ctx, args) => {
    const { telegramId, user } = await callerUser(ctx, args);
    if (!user) throw new Error("User not found");
    const duel = await findDuel(ctx, args.code);
    if (!duel) throw new Error("Duel not found");
    assertSameChat(duel, args.chatId);
    if (duel.creatorTelegramId !== telegramId) throw new Error("Only the host can continue");
    if (duel.status !== "reveal") {
      // Only advance after a reveal; this ignores double-taps that would skip a question.
      return await roundToView(ctx, duel, user._id, null);
    }

    const nextIndex = duel.currentIndex + 1;
    const now = Date.now();
    if (nextIndex >= duel.questionCount) {
      const players = await listPlayers(ctx, duel._id);
      const ranked = [...players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.totalTimeMs - b.totalTimeMs;
      });
      const top = ranked[0];
      const tied = ranked.filter((player) => player.score === top?.score);
      const winnerId = top && tied.length === 1 ? top.userId : undefined;
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
      const updated = await ctx.db.get(duel._id);
      if (!updated) throw new Error("Duel not found");
      return await roundToView(ctx, updated, user._id, null);
    }

    await ctx.db.patch(duel._id, {
      status: "question",
      currentIndex: nextIndex,
      roundStartedAt: now,
    });
    const updated = await ctx.db.get(duel._id);
    if (!updated) throw new Error("Duel not found");
    return await roundToView(ctx, updated, user._id, null);
  },
});

export const cancelGroupDuel = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    ...chatArg,
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { telegramId } = await callerUser(ctx, args);
    const duel = await findDuel(ctx, args.code);
    if (!duel) return null;
    assertSameChat(duel, args.chatId);
    if (duel.creatorTelegramId !== telegramId) throw new Error("Only the host can cancel");
    if (duel.status === "completed" || duel.status === "cancelled") return null;
    await ctx.db.patch(duel._id, { status: "cancelled", completedAt: Date.now() });
    return null;
  },
});
