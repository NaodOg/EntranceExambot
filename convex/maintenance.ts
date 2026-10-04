import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { reconcileFullAdminStats } from "./lib/adminStats";
import { publishedExamCountForTrack } from "./quota";

const SESSION_RETENTION_MS = 7 * 86_400_000;
const LINK_EVENT_RETENTION_MS = 90 * 86_400_000;
const PURGE_BATCH = 64;

export const reconcileAppStatsCron = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const tracks = await ctx.db.query("tracks").collect();
    for (const track of tracks) {
      const count = await publishedExamCountForTrack(ctx, track.slug);
      if (track.publishedExamCount !== count) {
        await ctx.db.patch(track._id, { publishedExamCount: count });
      }
    }
    await reconcileFullAdminStats(ctx, Date.now());
    return null;
  },
});

export const backfillTrackExamCounts = internalMutation({
  args: {},
  returns: v.object({ tracksUpdated: v.number() }),
  handler: async (ctx) => {
    const tracks = await ctx.db.query("tracks").collect();
    let tracksUpdated = 0;
    for (const track of tracks) {
      const count = await publishedExamCountForTrack(ctx, track.slug);
      if (track.publishedExamCount !== count) {
        await ctx.db.patch(track._id, { publishedExamCount: count });
        tracksUpdated += 1;
      }
    }
    return { tracksUpdated };
  },
});

export const purgeStaleChatSessions = internalMutation({
  args: {},
  returns: v.object({ removed: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - SESSION_RETENTION_MS;
    let removed = 0;
    for (const status of ["completed", "abandoned"] as const) {
      while (removed < 512) {
        const batch = await ctx.db
          .query("chatSessions")
          .withIndex("by_status_last_activity", (q) =>
            q.eq("status", status).lt("lastQuestionAt", cutoff),
          )
          .take(PURGE_BATCH);
        if (batch.length === 0) break;
        for (const row of batch) {
          await ctx.db.delete(row._id);
          removed += 1;
        }
      }
    }
    return { removed };
  },
});

export const purgeOldLinkEvents = internalMutation({
  args: {},
  returns: v.object({ removed: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - LINK_EVENT_RETENTION_MS;
    let removed = 0;
    while (removed < 512) {
      const batch = await ctx.db
        .query("linkEvents")
        .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
        .take(PURGE_BATCH);
      if (batch.length === 0) break;
      for (const row of batch) {
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }
    return { removed };
  },
});
