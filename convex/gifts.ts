import { v } from "convex/values";
import { resolveTelegramId } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { bumpAppStats } from "./quota";

export async function giftsByGifter(
  ctx: QueryCtx | MutationCtx,
  gifterId: Id<"users">,
): Promise<Doc<"proGifts">[]> {
  // by_gifter is still backfilling on this deploy and cannot be queried yet.
  const gifts = await ctx.db.query("proGifts").collect();
  return gifts.filter((gift) => gift.gifterId === gifterId);
}

const giftRow = v.object({
  _id: v.id("proGifts"),
  code: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("ready"),
    v.literal("claimed"),
    v.literal("void"),
  ),
  recipientUsername: v.optional(v.string()),
  recipientName: v.optional(v.string()),
  createdAt: v.number(),
  claimedAt: v.optional(v.number()),
});

export const listMine = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.array(giftRow),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user) return [];

    const gifts = await giftsByGifter(ctx, user._id);

    const rows = await Promise.all(
      gifts.map(async (gift) => {
        const recipient = gift.recipientId ? await ctx.db.get(gift.recipientId) : null;
        return {
          _id: gift._id,
          code: gift.code,
          status: gift.status,
          recipientUsername: gift.recipientUsername,
          recipientName: recipient?.firstName ?? recipient?.username,
          createdAt: gift.createdAt,
          claimedAt: gift.claimedAt,
        };
      }),
    );

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getByCode = query({
  args: { code: v.string() },
  returns: v.union(
    v.object({
      code: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.literal("claimed"),
        v.literal("void"),
      ),
      gifterName: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const gift = await ctx.db
      .query("proGifts")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!gift) return null;
    const gifter = await ctx.db.get(gift.gifterId);
    return {
      code: gift.code,
      status: gift.status,
      gifterName: gifter?.firstName ?? gifter?.username ?? "A friend",
    };
  },
});

export const redeem = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    code: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    expiresAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    if (user.isPro && (!user.proExpiresAt || user.proExpiresAt > now)) {
      throw new Error("You already have Pro");
    }

    const gift = await ctx.db
      .query("proGifts")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase().trim()))
      .unique();

    if (!gift) {
      throw new Error("Gift code not found");
    }
    if (gift.gifterId === user._id) {
      throw new Error("You cannot redeem your own gift");
    }
    if (gift.status === "pending") {
      throw new Error("This gift is still being reviewed");
    }
    if (gift.status === "claimed") {
      throw new Error("This gift was already claimed");
    }
    if (gift.status !== "ready") {
      throw new Error("This gift is no longer valid");
    }

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const seasonEnd = settings?.examSeasonEndAt ?? now;

    await ctx.db.patch(user._id, {
      isPro: true,
      proExpiresAt: seasonEnd,
      proApprovedAt: now,
      proApprovedBy: `gift:${gift.code}`,
    });
    if (!user.isPro) {
      await bumpAppStats(ctx, { proUsers: 1 }, { shardKey: String(user._id) });
    }

    await ctx.db.patch(gift._id, {
      status: "claimed",
      recipientId: user._id,
      claimedAt: now,
    });

    return { ok: true, expiresAt: seasonEnd };
  },
});
