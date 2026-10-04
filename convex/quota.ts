import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getCalendarDateString } from "./streak";

export type UsageItem = { label: string; questions: number };

export function quotaDateFor(nowMs: number): string {
  return getCalendarDateString(nowMs);
}

export function storedDailyUsage(
  user: Pick<
    Doc<"users">,
    "dailyQuotaDate" | "dailyQuestionsUsed" | "dailyDuelsUsed" | "dailyUsage"
  >,
  today: string,
): { questions: number; duels: number; usage: UsageItem[] } | null {
  if (user.dailyQuotaDate !== today) {
    return null;
  }
  return {
    questions: user.dailyQuestionsUsed ?? 0,
    duels: user.dailyDuelsUsed ?? 0,
    usage: user.dailyUsage ?? [],
  };
}

export function nextDailyUsagePatch(
  user: Pick<
    Doc<"users">,
    "dailyQuotaDate" | "dailyQuestionsUsed" | "dailyDuelsUsed" | "dailyUsage"
  >,
  nowMs: number,
  add: { questions: number; duels?: number; label: string },
) {
  const today = quotaDateFor(nowMs);
  const current = storedDailyUsage(user, today) ?? {
    questions: 0,
    duels: 0,
    usage: [] as UsageItem[],
  };
  const usage = [...current.usage, { label: add.label, questions: add.questions }].slice(-12);
  return {
    dailyQuotaDate: today,
    dailyQuestionsUsed: current.questions + add.questions,
    dailyDuelsUsed: current.duels + (add.duels ?? 0),
    dailyUsage: usage,
  };
}

export async function publishedExamCountFor(
  ctx: QueryCtx | MutationCtx,
  subjectSlug: string,
  stored?: number,
): Promise<number> {
  if (stored !== undefined && stored >= 0) {
    return stored;
  }
  const published = await ctx.db
    .query("exams")
    .withIndex("by_subject_published", (q) =>
      q.eq("subjectSlug", subjectSlug).eq("isPublished", true),
    )
    .take(512);
  return published.length;
}

/**
 * Published papers across every subject in a track.
 *
 * Needed separately from {@link publishedExamCountFor} because that one matches
 * on `exams.subjectSlug`; handing it a track slug matches nothing and reports 0.
 */
export async function publishedExamCountForTrack(
  ctx: QueryCtx | MutationCtx,
  trackSlug: string,
): Promise<number> {
  const subjects = await ctx.db
    .query("subjects")
    .withIndex("by_track", (q) => q.eq("trackSlug", trackSlug))
    .collect();
  let total = 0;
  for (const subject of subjects) {
    total += await publishedExamCountFor(ctx, subject.slug);
  }
  return total;
}

export async function bumpPublishedExamCount(
  ctx: MutationCtx,
  subjectSlug: string,
  delta: number,
) {
  if (delta === 0) return;
  const subject = await ctx.db
    .query("subjects")
    .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
    .unique();
  if (!subject) return;
  const current =
    subject.publishedExamCount ?? (await publishedExamCountFor(ctx, subjectSlug));
  await ctx.db.patch(subject._id, {
    publishedExamCount: Math.max(0, current + delta),
  });
}

const STATS_KEY = "global";
const STATS_SHARD_COUNT = 16;

function statsShardFor(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % STATS_SHARD_COUNT;
}

type StatShardPatch = {
  attempts?: number;
  totalXp?: number;
  totalUsers?: number;
  proUsers?: number;
};

export async function bumpStatShard(ctx: MutationCtx, shardKey: string, patch: StatShardPatch) {
  const shard = statsShardFor(shardKey);
  const existing = await ctx.db
    .query("appStatShards")
    .withIndex("by_key_shard", (q) => q.eq("key", STATS_KEY).eq("shard", shard))
    .unique();

  if (!existing) {
    await ctx.db.insert("appStatShards", {
      key: STATS_KEY,
      shard,
      attempts: patch.attempts ?? 0,
      totalXp: patch.totalXp ?? 0,
      totalUsers: patch.totalUsers ?? 0,
      proUsers: patch.proUsers ?? 0,
    });
    return;
  }

  await ctx.db.patch(existing._id, {
    attempts: existing.attempts + (patch.attempts ?? 0),
    totalXp: existing.totalXp + (patch.totalXp ?? 0),
    totalUsers: (existing.totalUsers ?? 0) + (patch.totalUsers ?? 0),
    proUsers: (existing.proUsers ?? 0) + (patch.proUsers ?? 0),
  });
}

/** @deprecated Use bumpStatShard */
export async function bumpUsageStats(
  ctx: MutationCtx,
  shardKey: string,
  patch: { attempts?: number; totalXp?: number },
) {
  await bumpStatShard(ctx, shardKey, patch);
}

export async function bumpAppStats(
  ctx: MutationCtx,
  patch: Partial<{
    totalUsers: number;
    proUsers: number;
    exams: number;
    questions: number;
    attempts: number;
    totalXp: number;
    tracks: number;
    publishedTracks: number;
    publishedExams: number;
    publishedQuestions: number;
  }>,
  options?: { shardKey?: string },
) {
  const shardKey = options?.shardKey;
  const hotUsers = patch.totalUsers ?? 0;
  const hotPro = patch.proUsers ?? 0;
  if (shardKey && (hotUsers !== 0 || hotPro !== 0)) {
    await bumpStatShard(ctx, shardKey, {
      totalUsers: hotUsers,
      proUsers: hotPro,
    });
  }

  const cold = {
    totalUsers: shardKey ? 0 : (patch.totalUsers ?? 0),
    proUsers: shardKey ? 0 : (patch.proUsers ?? 0),
    exams: patch.exams ?? 0,
    questions: patch.questions ?? 0,
    attempts: patch.attempts ?? 0,
    totalXp: patch.totalXp ?? 0,
    tracks: patch.tracks ?? 0,
    publishedTracks: patch.publishedTracks ?? 0,
    publishedExams: patch.publishedExams ?? 0,
    publishedQuestions: patch.publishedQuestions ?? 0,
  };
  const hasCold = Object.values(cold).some((value) => value !== 0);
  if (!hasCold && shardKey) {
    return;
  }

  const existing = await ctx.db
    .query("appStats")
    .withIndex("by_key", (q) => q.eq("key", STATS_KEY))
    .unique();

  if (!existing) {
    await ctx.db.insert("appStats", {
      key: STATS_KEY,
      totalUsers: cold.totalUsers,
      proUsers: cold.proUsers,
      exams: cold.exams,
      questions: cold.questions,
      attempts: cold.attempts,
      totalXp: cold.totalXp,
      tracks: cold.tracks,
      publishedTracks: cold.publishedTracks,
      publishedExams: cold.publishedExams,
      publishedQuestions: cold.publishedQuestions,
    });
    return;
  }

  await ctx.db.patch(existing._id, {
    totalUsers: existing.totalUsers + cold.totalUsers,
    proUsers: existing.proUsers + cold.proUsers,
    exams: existing.exams + cold.exams,
    questions: existing.questions + cold.questions,
    attempts: existing.attempts + cold.attempts,
    totalXp: existing.totalXp + cold.totalXp,
    tracks: existing.tracks + cold.tracks,
    publishedTracks: existing.publishedTracks + cold.publishedTracks,
    publishedExams: (existing.publishedExams ?? 0) + cold.publishedExams,
    publishedQuestions: (existing.publishedQuestions ?? 0) + cold.publishedQuestions,
  });
}

export async function readAppStats(ctx: QueryCtx | MutationCtx) {
  const base = await ctx.db
    .query("appStats")
    .withIndex("by_key", (q) => q.eq("key", STATS_KEY))
    .unique();
  const shards = await ctx.db
    .query("appStatShards")
    .withIndex("by_key", (q) => q.eq("key", STATS_KEY))
    .collect();

  if (!base) return null;
  return {
    ...base,
    totalUsers: base.totalUsers + shards.reduce((sum, shard) => sum + (shard.totalUsers ?? 0), 0),
    proUsers: base.proUsers + shards.reduce((sum, shard) => sum + (shard.proUsers ?? 0), 0),
    attempts: base.attempts + shards.reduce((sum, shard) => sum + shard.attempts, 0),
    totalXp: base.totalXp + shards.reduce((sum, shard) => sum + shard.totalXp, 0),
  };
}

export function usageLabelForExam(qCount: number, examTitle?: string): string {
  if (qCount <= 10) {
    return qCount === 10 ? "Quick 10" : `Exam (${qCount} Q)`;
  }
  if (examTitle) return examTitle;
  return `Exam (${qCount} Q)`;
}
