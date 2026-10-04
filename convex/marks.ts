import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveTelegramId } from "./lib/auth";
import { readGlobalSettings } from "./settings";

const actorArgs = {
  telegramId: v.optional(v.string()),
  initData: v.optional(v.string()),
  botProof: v.optional(v.string()),
};

/** Marks a question is worth, defaulting to 1 when unset. */
export function marksOf(question: Pick<Doc<"questions">, "marks">): number {
  return question.marks ?? 1;
}

async function subjectDoc(
  ctx: MutationCtx,
  subjectSlug: string,
): Promise<Doc<"subjects"> | null> {
  return await ctx.db
    .query("subjects")
    .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
    .unique();
}

/**
 * Records the subject mark produced by a completed paper.
 *
 * Only full mock sittings qualify: a paper counts as full when every question
 * on the exam was submitted, which the server can verify from the question
 * count rather than trusting a client flag. Writes are idempotent per attempt
 * so a retried submit cannot double-count a mark.
 */
export async function recordMockMark(
  ctx: MutationCtx,
  params: {
    userId: Id<"users">;
    attemptId: Id<"attempts">;
    trackSlug: string;
    subjectSlug: string;
    score: number;
    availableMarks: number;
    subjectMaxMarks: number;
    label?: string;
    createdAt: number;
  },
): Promise<boolean> {
  const existing = await ctx.db
    .query("markEntries")
    .withIndex("by_user", (q) => q.eq("userId", params.userId))
    .filter(
      (q) =>
        q.eq(q.field("source"), "attempt") &&
        q.eq(q.field("attemptId"), params.attemptId),
    )
    .first();
  if (existing) return false;

  await ctx.db.insert("markEntries", {
    userId: params.userId,
    trackSlug: params.trackSlug,
    subjectSlug: params.subjectSlug,
    source: "attempt",
    score: params.score,
    availableMarks: params.availableMarks,
    subjectMaxMarks: params.subjectMaxMarks,
    attemptId: params.attemptId,
    label: params.label,
    createdAt: params.createdAt,
  });
  return true;
}

/** Latest entry for a subject, which is what the running total reflects. */
async function latestForSubject(
  ctx: QueryCtx,
  userId: Id<"users">,
  subjectSlug: string,
): Promise<Doc<"markEntries"> | null> {
  return await ctx.db
    .query("markEntries")
    .withIndex("by_user_subject", (q) =>
      q.eq("userId", userId).eq("subjectSlug", subjectSlug),
    )
    .order("desc")
    .first();
}

/**
 * Projected totals for the student's track: the newest mark per published
 * subject, plus the track maximum summed from those subjects' `maxMarks`.
 */
export const getTrackTotals = query({
  args: {
    ...actorArgs,
    trackSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user) return null;

    const trackSlug = args.trackSlug ?? user.trackSlug ?? "";
    if (!trackSlug) return null;

    const track = await ctx.db
      .query("tracks")
      .withIndex("by_slug", (q) => q.eq("slug", trackSlug))
      .unique();
    if (!track) return null;

    const language = user.language === "am" ? "am" : "en";
    const subjects = (
      await ctx.db
        .query("subjects")
        .withIndex("by_track", (q) => q.eq("trackSlug", trackSlug))
        .filter((q) => q.eq(q.field("isPublished"), true))
        .collect()
    ).sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));

    const rows = [];
    for (const subject of subjects) {
      const entry = await latestForSubject(ctx, user._id, subject.slug);
      rows.push({
        slug: subject.slug,
        entryId: entry?._id ?? null,
        nameEn: subject.nameEn,
        nameAm: subject.nameAm,
        maxMarks: subject.maxMarks ?? 100,
        score: entry?.score ?? null,
        source: entry?.source ?? null,
        updatedAt: entry?.createdAt ?? null,
        isProOnly: subject.isProOnly,
      });
    }

    // A subject with no mark yet contributes its maximum to the denominator but
    // nothing to the numerator, so an untouched subject reads as 0, not blank.
    const trackMax = rows.reduce((sum, row) => sum + row.maxMarks, 0);
    const earned = rows.reduce((sum, row) => sum + (row.score ?? 0), 0);

    return {
      track: {
        slug: track.slug,
        nameEn: track.nameEn,
        nameAm: language === "am" ? track.nameAm || track.nameEn : track.nameEn,
      },
      language,
      subjects: rows,
      earned,
      trackMax,
      percent: trackMax > 0 ? Math.round((earned / trackMax) * 100) : 0,
      gradedCount: rows.filter((row) => row.score !== null).length,
    };
  },
});

/**
 * Typed-in subject mark, for results from a real exam the student sat offline.
 * Off by default so a stray client cannot inflate a projected total.
 */
export const upsertManualMark = mutation({
  args: {
    ...actorArgs,
    subjectSlug: v.string(),
    score: v.number(),
    subjectMaxMarks: v.optional(v.number()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settings = await readGlobalSettings(ctx);
    if (settings?.allowManualMarkEntry !== true) {
      throw new Error("Manual mark entry is disabled");
    }

    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user) throw new Error("User not found");

    const subject = await subjectDoc(ctx, args.subjectSlug);
    if (!subject || !subject.isPublished) {
      throw new Error("Unknown subject");
    }

    const trackSlug = subject.trackSlug;
    const maxMarks = args.subjectMaxMarks ?? subject.maxMarks ?? 100;
    if (maxMarks <= 0) throw new Error("Subject max marks must be positive");
    if (args.score < 0 || args.score > maxMarks) {
      throw new Error(`Score must be between 0 and ${maxMarks}`);
    }

    // Replace any existing manual entry for this subject so the student cannot
    // stack several and double their total.
    const prior = await ctx.db
      .query("markEntries")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", user._id).eq("subjectSlug", args.subjectSlug),
      )
      .filter((q) => q.eq(q.field("source"), "manual"))
      .first();

    const payload = {
      userId: user._id,
      trackSlug,
      subjectSlug: args.subjectSlug,
      source: "manual" as const,
      score: args.score,
      availableMarks: maxMarks,
      subjectMaxMarks: maxMarks,
      label: args.label,
      createdAt: Date.now(),
    };

    if (prior) {
      await ctx.db.patch(prior._id, payload);
      return prior._id;
    }
    return await ctx.db.insert("markEntries", payload);
  },
});

/** Removes a single mark entry, e.g. a typo in a manual entry. */
export const deleteMarkEntry = mutation({
  args: {
    ...actorArgs,
    markEntryId: v.id("markEntries"),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const entry = await ctx.db.get(args.markEntryId);
    if (!entry) throw new Error("Mark entry not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user || entry.userId !== user._id) {
      throw new Error("Not your mark entry");
    }

    // Attempt-derived marks are a record of a real sitting, not something the
    // student should be able to erase.
    if (entry.source === "attempt") {
      throw new Error("Marks from a completed paper cannot be deleted");
    }

    await ctx.db.delete(args.markEntryId);
    return null;
  },
});

/** History list for one subject. */
export const listMarkEntries = query({
  args: {
    ...actorArgs,
    subjectSlug: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user) return [];

    const limit = Math.min(50, Math.max(1, args.limit ?? 20));
    const base = await ctx.db
      .query("markEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);

    const rows = args.subjectSlug
      ? base.filter((row) => row.subjectSlug === args.subjectSlug)
      : base;
    return rows.slice(0, limit);
  },
});