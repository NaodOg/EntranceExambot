import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin, resolveTelegramId } from "./lib/auth";
import { resolveNowMs } from "./lib/now";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { readCheapAdminStats, reconcileFullAdminStats } from "./lib/adminStats";
import { bumpAppStats } from "./quota";
import { storedPeriodXp, type LeaderboardPeriod } from "./period";
import { accentValues, fontSizeValues, themeValues } from "./schema";
import { getActiveDisplayStreak } from "./streak";
import { clampDailyGoal } from "./exams";
import { attributeSignup } from "./links";

const languageValues = v.union(v.literal("am"), v.literal("en"));

function isProActiveUser(user: { isPro: boolean; proExpiresAt?: number }, now = Date.now()) {
  return user.isPro && (!user.proExpiresAt || user.proExpiresAt > now);
}

function assertTrackChange(
  user: {
    trackSlug?: string;
    onboardingComplete?: boolean;
    isPro: boolean;
    proExpiresAt?: number;
  },
  nextSlug: string | undefined,
) {
  if (nextSlug === undefined || nextSlug === user.trackSlug) {
    return;
  }
  const firstLock = !user.trackSlug || !user.onboardingComplete;
  if (firstLock) {
    return;
  }
  if (isProActiveUser(user)) {
    return;
  }
  throw new Error("Track can only be changed with Pro");
}

/**
 * A student's subject picks must stay inside their track, otherwise they could
 * pin subjects from a track they cannot see and quietly walk around the track
 * gate. Unknown and unpublished slugs are dropped; duplicates collapse.
 */
async function sanitizeSubjectSlugs(
  ctx: QueryCtx | MutationCtx,
  trackSlug: string | undefined,
  subjectSlugs: string[] | undefined,
): Promise<string[] | undefined> {
  if (subjectSlugs === undefined) return undefined;
  if (!trackSlug) return [];

  const wanted = Array.from(new Set(subjectSlugs));
  if (!wanted.length) return [];

  const published = await ctx.db
    .query("subjects")
    .withIndex("by_published", (q) =>
      q.eq("trackSlug", trackSlug).eq("isPublished", true),
    )
    .collect();
  const allowed = new Set(published.map((subject) => subject.slug));
  return wanted.filter((slug) => allowed.has(slug));
}

function withDefaults(user: {
  theme?: string;
  accent?: string;
  fontSize?: "sm" | "md" | "lg";
  hapticsEnabled?: boolean;
  soundEnabled?: boolean;
  dailyGoal?: number;
  examYear?: number;
  showBilingual?: boolean;
  reduceMotion?: boolean;
  instantFeedback?: boolean;
  onboardingComplete?: boolean;
  isPro: boolean;
  proExpiresAt?: number;
}, nowMs: number) {
  return {
    theme: user.theme ?? "obsidian",
    accent: user.accent ?? "azure",
    fontSize: user.fontSize ?? "md",
    hapticsEnabled: user.hapticsEnabled ?? true,
    soundEnabled: user.soundEnabled ?? false,
    dailyGoal: clampDailyGoal(user.dailyGoal, isProActiveUser(user, nowMs)),
    examYear: user.examYear,
    showBilingual: user.showBilingual ?? false,
    reduceMotion: user.reduceMotion ?? false,
    instantFeedback: user.instantFeedback ?? true,
    onboardingComplete: user.onboardingComplete ?? false,
    isProActive: isProActiveUser(user, nowMs),
  };
}

export const getOrCreateFromTelegram = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    language: v.optional(languageValues),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    const now = Date.now();

    if (existing) {
      if (existing.isBanned) {
        throw new Error(
          "ACCOUNT_BANNED: This account has been suspended. Contact support if you think this is a mistake.",
        );
      }
      const username = args.username ?? existing.username;
      const firstName = args.firstName ?? existing.firstName;
      if (username !== existing.username || firstName !== existing.firstName) {
        await ctx.db.patch(existing._id, { username, firstName });
      }
      const updated = { ...existing, username, firstName };
      return {
        ...updated,
        streakCount: getActiveDisplayStreak(updated),
        ...withDefaults(updated, now),
      };
    }

    const userId = await ctx.db.insert("users", {
      telegramId: telegramId,
      username: args.username,
      firstName: args.firstName,
      language: args.language ?? "en",
      isPro: false,
      streakCount: 0,
      lastActiveAt: now,
      xp: 0,
      createdAt: now,
      theme: "obsidian",
      accent: "azure",
      fontSize: "md",
      hapticsEnabled: true,
      soundEnabled: false,
      dailyGoal: 20,
      showBilingual: false,
      reduceMotion: false,
      instantFeedback: true,
      onboardingComplete: false,
    });
    await bumpAppStats(ctx, { totalUsers: 1 }, { shardKey: telegramId });
    const created = await ctx.db.get(userId);
    if (!created) throw new Error("Failed to create user");
    return {
      ...created,
      streakCount: getActiveDisplayStreak(created),
      ...withDefaults(created, now),
    };
  },
});

export const getByTelegramId = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    /**
     * Required so this query stays cacheable. Callers pass a value bucketed to
     * the minute (see `authed-convex.ts`), which keeps Pro-expiry correct while
     * letting Convex memoise the result for the rest of the minute. Reading the
     * clock inside the query instead would make every response unique and
     * permanently cold.
     */
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const nowMs = resolveNowMs(args.nowMs);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      return null;
    }

    const activeStreak = getActiveDisplayStreak(user, nowMs);

    return {
      ...user,
      streakCount: activeStreak,
      ...withDefaults(user, nowMs),
    };
  },
});

export const updateProfile = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    language: v.optional(languageValues),
    trackSlug: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    assertTrackChange(user, args.trackSlug);

    await ctx.db.patch(user._id, {
      language: args.language ?? user.language,
      trackSlug: args.trackSlug ?? user.trackSlug,
      lastActiveAt: Date.now(),
    });

    return user._id;
  },
});

export const updatePreferences = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    language: v.optional(languageValues),
    trackSlug: v.optional(v.string()),
    subjectSlugs: v.optional(v.array(v.string())),
    theme: v.optional(themeValues),
    accent: v.optional(accentValues),
    fontSize: v.optional(fontSizeValues),
    hapticsEnabled: v.optional(v.boolean()),
    soundEnabled: v.optional(v.boolean()),
    dailyGoal: v.optional(v.number()),
    examYear: v.optional(v.number()),
    showBilingual: v.optional(v.boolean()),
    reduceMotion: v.optional(v.boolean()),
    instantFeedback: v.optional(v.boolean()),
    onboardingComplete: v.optional(v.boolean()),
    firstName: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    assertTrackChange(user, args.trackSlug);

    // Subjects follow the track, so resolve them against whichever track the
    // student ends up on (the new one when this call also changes it).
    const nextTrackSlug = args.trackSlug ?? user.trackSlug;
    const nextSubjectSlugs = await sanitizeSubjectSlugs(
      ctx,
      nextTrackSlug,
      args.subjectSlugs,
    );
    if (nextSubjectSlugs !== undefined) {
      args.subjectSlugs = nextSubjectSlugs;
    }

    const cleaned = Object.fromEntries(
      Object.entries(args).filter(
        ([key, value]) =>
          value !== undefined &&
          key !== "telegramId" &&
          key !== "initData" &&
          key !== "botProof",
      ),
    );
    if (typeof cleaned.dailyGoal === "number") {
      cleaned.dailyGoal = clampDailyGoal(cleaned.dailyGoal, isProActiveUser(user));
    }

    await ctx.db.patch(user._id, {
      ...cleaned,
      lastActiveAt: Date.now(),
    });

    const wasOnboarded = user.onboardingComplete ?? false;
    const isOnboarded = args.onboardingComplete ?? wasOnboarded;
    if (!wasOnboarded && isOnboarded) {
      await attributeSignup(ctx, user);
    }

    return user._id;
  },
});

export const listForAdmin = query({
  args: {
    adminSecret: v.string(),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const nowMs = resolveNowMs(args.nowMs);
    const needle = args.search?.trim().toLowerCase();

    if (!needle) {
      const result = await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
      return {
        ...result,
        page: result.page.map((user) => ({ ...user, ...withDefaults(user, nowMs) })),
      };
    }

    // Free-text search over a bounded window, then page the filtered matches.
    const window = await ctx.db.query("users").order("desc").take(2000);
    const matched = window
      .filter((user) => {
        const haystack = [
          user.firstName,
          user.username,
          user.telegramId,
          user.trackSlug,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .map((user) => ({ ...user, ...withDefaults(user, nowMs) }));

    const offset = args.paginationOpts.cursor ? Number(args.paginationOpts.cursor) : 0;
    const page = matched.slice(offset, offset + args.paginationOpts.numItems);
    const next = offset + page.length;
    return {
      page,
      isDone: next >= matched.length,
      continueCursor: String(next),
    };
  },
});

const adminStatsReturn = v.object({
  totalUsers: v.number(),
  proUsers: v.number(),
  pendingPremium: v.number(),
  activeToday: v.number(),
  activeWeek: v.number(),
  newUsersToday: v.number(),
  tracks: v.number(),
  publishedTracks: v.number(),
  exams: v.number(),
  publishedExams: v.number(),
  questions: v.number(),
  publishedQuestions: v.number(),
  attempts: v.number(),
  attemptsToday: v.number(),
  openReports: v.number(),
  resolvedReports: v.number(),
  dismissedReports: v.number(),
  totalReports: v.number(),
});

/** Expensive full DB reconcile â€” manual admin action or weekly cron only. */
export const reconcileAppStats = mutation({
  args: {
    adminSecret: v.string(),
  },
  returns: adminStatsReturn,
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    return await reconcileFullAdminStats(ctx, Date.now());
  },
});

/** @deprecated No-op for older admin bundles; use reconcileAppStats when counters need a full rebuild. */
export const ensureAppStats = mutation({
  args: {
    adminSecret: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    return null;
  },
});

export const getStats = query({
  args: {
    adminSecret: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: adminStatsReturn,
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const now = args.nowMs ?? Date.now();
    return await readCheapAdminStats(ctx, now);
  },
});

const leaderboardPeriod = v.union(
  v.literal("biweekly"),
  v.literal("monthly"),
  v.literal("all_time"),
);

const leaderboardEntry = v.object({
  rank: v.number(),
  name: v.string(),
  username: v.optional(v.string()),
  xp: v.number(),
  streakCount: v.number(),
  isPro: v.boolean(),
  isCurrentUser: v.boolean(),
});

export const getTrackLeaderboard = query({
  args: {
    trackSlug: v.string(),
    telegramId: v.optional(v.string()),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    period: v.optional(leaderboardPeriod),
    windowStartMs: v.optional(v.number()),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    period: leaderboardPeriod,
    totalPlayers: v.number(),
    userRank: v.union(v.number(), v.null()),
    userXp: v.number(),
    top50: v.array(leaderboardEntry),
  }),
  handler: async (ctx, args) => {
    const period = args.period ?? "all_time";
    const nowMs = args.nowMs ?? 0;
    const windowStartMs = args.windowStartMs ?? 0;

    const currentUser = args.telegramId
      ? await ctx.db
          .query("users")
          .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId!))
          .unique()
      : null;

    const candidates =
      period === "biweekly"
        ? await ctx.db
            .query("users")
            .withIndex("by_track_biweekly", (q) =>
              q
                .eq("trackSlug", args.trackSlug)
                .eq("biweeklyWindowStart", windowStartMs),
            )
            .order("desc")
            .take(50)
        : period === "monthly"
          ? await ctx.db
              .query("users")
              .withIndex("by_track_monthly", (q) =>
                q
                  .eq("trackSlug", args.trackSlug)
                  .eq("monthlyWindowStart", windowStartMs),
              )
              .order("desc")
              .take(50)
          : await ctx.db
              .query("users")
              .withIndex("by_track_xp", (q) =>
                q.eq("trackSlug", args.trackSlug),
              )
              .order("desc")
              .take(50);

    const ranked = candidates
      .map((user) => ({
        user,
        xp:
          period === "all_time"
            ? user.xp
            : storedPeriodXp(
                user,
                period as Exclude<LeaderboardPeriod, "all_time">,
                windowStartMs,
              ),
      }))
      .filter((row) => row.xp > 0 || period === "all_time");

    ranked.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      return getActiveDisplayStreak(b.user, nowMs) - getActiveDisplayStreak(a.user, nowMs);
    });

    const userRankIndex = currentUser
      ? ranked.findIndex((row) => row.user._id === currentUser._id)
      : -1;
    const userXp =
      userRankIndex !== -1
        ? (ranked[userRankIndex]?.xp ?? 0)
        : currentUser
          ? period === "all_time"
            ? currentUser.xp
            : storedPeriodXp(
                currentUser,
                period as Exclude<LeaderboardPeriod, "all_time">,
                windowStartMs,
              )
          : 0;

    const top50 = ranked.slice(0, 50).map((row, index) => ({
      rank: index + 1,
      name: row.user.firstName ?? row.user.username ?? "Anonymous",
      username: row.user.username,
      xp: row.xp,
      streakCount: getActiveDisplayStreak(row.user, nowMs),
      isPro: isProActiveUser(row.user, nowMs),
      isCurrentUser: currentUser ? row.user._id === currentUser._id : false,
    }));

    return {
      period,
      totalPlayers: ranked.length,
      userRank:
        userRankIndex !== -1 && (ranked[userRankIndex]?.xp ?? 0) > 0
          ? userRankIndex + 1
          : period === "all_time" && userRankIndex !== -1
            ? userRankIndex + 1
            : null,
      userXp,
      top50: top50.filter((row) => row.xp > 0 || period === "all_time"),
    };
  },
});
