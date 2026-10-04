import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin, resolveTelegramId } from "./lib/auth";
import { mutation, query } from "./_generated/server";
import { giftsByGifter } from "./gifts";
import { bumpAppStats } from "./quota";

export const listPending = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const requests = await ctx.db
      .query("premiumRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    return await Promise.all(
      requests.map(async (request) => {
        const user = await ctx.db.get(request.userId);
        const proofUrl = request.proofFileId
          ? await ctx.storage.getUrl(request.proofFileId)
          : null;

        return {
          ...request,
          user,
          proofUrl,
        };
      }),
    );
  },
});

function makeGiftCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)] ?? "X";
  }
  return code;
}

export const submitRequest = mutation({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    transactionRef: v.optional(v.string()),
    proofFileId: v.optional(v.id("_storage")),
    kind: v.optional(v.union(v.literal("self"), v.literal("gift"))),
    giftRecipient: v.optional(v.string()),
  },
  returns: v.id("premiumRequests"),
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const existingPending = await ctx.db
      .query("premiumRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingPending) {
      throw new Error("You already have a pending premium request");
    }

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    const kind = args.kind ?? "self";
    if (kind === "gift") {
      const now = Date.now();
      const isPro = user.isPro && (!user.proExpiresAt || user.proExpiresAt > now);
      if (!isPro) {
        throw new Error("Only Pro members can gift a friend");
      }
    }

    let giftCode: string | undefined;
    if (kind === "gift") {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = makeGiftCode();
        const taken = await ctx.db
          .query("premiumRequests")
          .withIndex("by_gift_code", (q) => q.eq("giftCode", candidate))
          .unique();
        if (!taken) {
          giftCode = candidate;
          break;
        }
      }
      if (!giftCode) {
        throw new Error("Could not create a gift code. Try again.");
      }
    }

    const requestId = await ctx.db.insert("premiumRequests", {
      userId: user._id,
      amountEtb: settings?.proPriceEtb ?? 200,
      transactionRef: args.transactionRef,
      proofFileId: args.proofFileId,
      status: "pending",
      kind,
      giftCode,
      giftRecipient: args.giftRecipient?.replace(/^@/, "").trim() || undefined,
      createdAt: Date.now(),
    });

    if (kind === "gift" && giftCode) {
      await ctx.db.insert("proGifts", {
        code: giftCode,
        gifterId: user._id,
        requestId,
        recipientUsername: args.giftRecipient?.replace(/^@/, "").trim() || undefined,
        status: "pending",
        createdAt: Date.now(),
      });
    }

    return requestId;
  },
});

export const approve = mutation({
  args: {
    adminSecret: v.string(),
    requestId: v.id("premiumRequests"),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") {
      throw new Error("Request not found or already reviewed");
    }

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    const seasonEnd = settings?.examSeasonEndAt ?? Date.now();
    const now = Date.now();

    await ctx.db.patch(request._id, {
      status: "approved",
      reviewedBy: adminEmail,
      reviewedAt: now,
    });

    if (request.kind === "gift") {
      const gift = await giftsByGifter(ctx, request.userId);
      const match = gift.find((row) => row.requestId === request._id);
      if (match) {
        await ctx.db.patch(match._id, { status: "ready" });
      }
    } else {
      await ctx.db.patch(request.userId, {
        isPro: true,
        proExpiresAt: seasonEnd,
        proApprovedAt: now,
        proApprovedBy: adminEmail,
      });
      await bumpAppStats(ctx, { proUsers: 1 }, { shardKey: String(request.userId) });
    }

    await ctx.db.insert("auditLog", {
      adminEmail: adminEmail,
      action: "premium.approve",
      targetType: "premiumRequests",
      targetId: request._id,
      createdAt: now,
    });

    const user = await ctx.db.get(request.userId);
    return user?.telegramId;
  },
});

export const reject = mutation({
  args: {
    adminSecret: v.string(),
    requestId: v.id("premiumRequests"),
    adminEmail: v.string(),
    rejectionReason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") {
      throw new Error("Request not found or already reviewed");
    }

    await ctx.db.patch(request._id, {
      status: "rejected",
      rejectionReason: args.rejectionReason,
      reviewedBy: adminEmail,
      reviewedAt: Date.now(),
    });

    if (request.kind === "gift") {
      const gifts = await giftsByGifter(ctx, request.userId);
      const match = gifts.find((row) => row.requestId === request._id);
      if (match) {
        await ctx.db.patch(match._id, { status: "void" });
      }
    }

    await ctx.db.insert("auditLog", {
      adminEmail: adminEmail,
      action: "premium.reject",
      targetType: "premiumRequests",
      targetId: request._id,
      metadata: JSON.stringify({ rejectionReason: args.rejectionReason }),
      createdAt: Date.now(),
    });

    const user = await ctx.db.get(request.userId);
    return user?.telegramId;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const listAll = query({
  args: {
    adminSecret: v.string(),
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const scoped = args.status
      ? ctx.db
          .query("premiumRequests")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
      : ctx.db.query("premiumRequests");
    const result = await scoped.order("desc").paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (request) => {
          const user = await ctx.db.get(request.userId);
          const proofUrl = request.proofFileId
            ? await ctx.storage.getUrl(request.proofFileId)
            : null;

          return {
            ...request,
            user,
            proofUrl,
          };
        }),
      ),
    };
  },
});

export const getMyRequest = query({
  args: {
    telegramId: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    if (!user) {
      return null;
    }

    const requests = await ctx.db
      .query("premiumRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(1);

    return requests[0] ?? null;
  },
});
