import type { MutationCtx, QueryCtx } from "../_generated/server";
import { readAppStats } from "../quota";

/** Cap per-metric index reads (no `.paginate()` â€” Convex allows only one per function). */
const MAX_INDEX_COUNT = 10_000;

function isProActiveUser(user: { isPro: boolean; proExpiresAt?: number }, now: number) {
  return user.isPro && (!user.proExpiresAt || user.proExpiresAt > now);
}

export async function countUsersActiveSince(ctx: QueryCtx, sinceMs: number): Promise<number> {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_last_active", (q) => q.gte("lastActiveAt", sinceMs))
    .take(MAX_INDEX_COUNT);
  return rows.length;
}

export async function countUsersCreatedSince(ctx: QueryCtx, sinceMs: number): Promise<number> {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_created", (q) => q.gte("createdAt", sinceMs))
    .take(MAX_INDEX_COUNT);
  return rows.length;
}

export async function countAttemptsSince(ctx: QueryCtx, sinceMs: number): Promise<number> {
  const rows = await ctx.db
    .query("attempts")
    .withIndex("by_completed", (q) => q.gte("completedAt", sinceMs))
    .take(MAX_INDEX_COUNT);
  return rows.length;
}

async function countReportStatuses(ctx: QueryCtx) {
  const [openReports, resolvedReports, dismissedReports, pendingPremiumRows] =
    await Promise.all([
      ctx.db
        .query("questionReports")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect(),
      ctx.db
        .query("questionReports")
        .withIndex("by_status", (q) => q.eq("status", "resolved"))
        .collect(),
      ctx.db
        .query("questionReports")
        .withIndex("by_status", (q) => q.eq("status", "dismissed"))
        .collect(),
      ctx.db
        .query("premiumRequests")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
    ]);
  return {
    openReports: openReports.length,
    resolvedReports: resolvedReports.length,
    dismissedReports: dismissedReports.length,
    totalReports:
      openReports.length + resolvedReports.length + dismissedReports.length,
    pendingPremium: pendingPremiumRows.length,
  };
}

/** Admin dashboard stats without full-table scans. */
export async function readCheapAdminStats(ctx: QueryCtx, now: number) {
  const dayAgo = now - 86_400_000;
  const weekAgo = now - 7 * 86_400_000;

  const [counters, reports, activeToday, activeWeek, newUsersToday, attemptsToday] =
    await Promise.all([
      readAppStats(ctx),
      countReportStatuses(ctx),
      countUsersActiveSince(ctx, dayAgo),
      countUsersActiveSince(ctx, weekAgo),
      countUsersCreatedSince(ctx, dayAgo),
      countAttemptsSince(ctx, dayAgo),
    ]);

  return {
    totalUsers: counters?.totalUsers ?? 0,
    proUsers: counters?.proUsers ?? 0,
    pendingPremium: reports.pendingPremium,
    activeToday,
    activeWeek,
    newUsersToday,
    tracks: counters?.tracks ?? 0,
    publishedTracks: counters?.publishedTracks ?? 0,
    exams: counters?.exams ?? 0,
    publishedExams: counters?.publishedExams ?? 0,
    questions: counters?.questions ?? 0,
    publishedQuestions: counters?.publishedQuestions ?? 0,
    attempts: counters?.attempts ?? 0,
    attemptsToday,
    openReports: reports.openReports,
    resolvedReports: reports.resolvedReports,
    dismissedReports: reports.dismissedReports,
    totalReports: reports.totalReports,
  };
}

/** Full reconcile (expensive). Admin manual action or scheduled job only. */
export async function reconcileFullAdminStats(ctx: MutationCtx, now: number) {
  const dayAgo = now - 86_400_000;
  const weekAgo = now - 7 * 86_400_000;

  const [
    users,
    tracks,
    exams,
    questions,
    attempts,
    pendingPremiumRows,
    openReports,
    resolvedReports,
    dismissedReports,
  ] = await Promise.all([
    ctx.db.query("users").collect(),
    ctx.db.query("tracks").collect(),
    ctx.db.query("exams").collect(),
    ctx.db.query("questions").collect(),
    ctx.db.query("attempts").collect(),
    ctx.db
      .query("premiumRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect(),
    ctx.db
      .query("questionReports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect(),
    ctx.db
      .query("questionReports")
      .withIndex("by_status", (q) => q.eq("status", "resolved"))
      .collect(),
    ctx.db
      .query("questionReports")
      .withIndex("by_status", (q) => q.eq("status", "dismissed"))
      .collect(),
  ]);

  const publishedExams = exams.filter((exam) => exam.isPublished);
  const publishedExamIds = new Set(publishedExams.map((exam) => exam._id));

  const totalXp = users.reduce((sum, user) => sum + user.xp, 0);
  const proUsers = users.filter((user) => isProActiveUser(user, now)).length;

  const values = {
    totalUsers: users.length,
    proUsers,
    exams: exams.length,
    questions: questions.length,
    attempts: attempts.length,
    totalXp,
    tracks: tracks.length,
    publishedTracks: tracks.filter((d) => d.isPublished).length,
    publishedExams: publishedExams.length,
    publishedQuestions: questions.filter((q) => publishedExamIds.has(q.examId)).length,
  };

  const base = await ctx.db
    .query("appStats")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();

  if (base) {
    await ctx.db.patch(base._id, values);
  } else {
    await ctx.db.insert("appStats", { key: "global", ...values });
  }

  const shards = await ctx.db
    .query("appStatShards")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .collect();
  for (const shard of shards) {
    const hasShardDelta =
      shard.attempts !== 0 ||
      shard.totalXp !== 0 ||
      (shard.totalUsers ?? 0) !== 0 ||
      (shard.proUsers ?? 0) !== 0;
    if (hasShardDelta) {
      await ctx.db.patch(shard._id, {
        attempts: 0,
        totalXp: 0,
        totalUsers: 0,
        proUsers: 0,
      });
    }
  }

  return {
    ...values,
    pendingPremium: pendingPremiumRows.length,
    activeToday: users.filter((u) => (u.lastActiveAt ?? 0) >= dayAgo).length,
    activeWeek: users.filter((u) => (u.lastActiveAt ?? 0) >= weekAgo).length,
    newUsersToday: users.filter((u) => u.createdAt >= dayAgo).length,
    attemptsToday: attempts.filter((a) => a.completedAt >= dayAgo).length,
    openReports: openReports.length,
    resolvedReports: resolvedReports.length,
    dismissedReports: dismissedReports.length,
    totalReports:
      openReports.length + resolvedReports.length + dismissedReports.length,
  };
}
