import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const SETTINGS_KEY = "global";

/**
 * Reads the global settings row from either a query or mutation context.
 * Server code that must branch on a setting cannot call the `get` query, so
 * mutations share this reader instead of re-implementing the lookup.
 */
export async function readGlobalSettings(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"settings"> | null> {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await readGlobalSettings(ctx);
  },
});

export const ensureDefaults = mutation({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();

    if (existing) {
      return existing._id;
    }

    const sixMonthsFromNow = Date.now() + 1000 * 60 * 60 * 24 * 183;

    return await ctx.db.insert("settings", {
      key: SETTINGS_KEY,
      proPriceEtb: 200,
      examSeasonEndAt: sixMonthsFromNow,
      paymentInstructionsAm:
        "200 ብር በቴሌብር ይላኩ እና የክፍያ ስክሪንሾት እዚህ ይጫኑ።",
      paymentInstructionsEn:
        "Send 200 ETB via Telebirr and upload your payment screenshot here.",
      freeMockLimitPerMonth: 3,
      freeDailyQuestionCap: 20,
      allowManualMarkEntry: true,
      telebirrNumber: "",
      cbeNumber: "",
      telebirrName: "",
      cbeName: "",
    });
  },
});

export const updateSeasonEnd = mutation({
  args: {
    adminSecret: v.string(),
    examSeasonEndAt: v.number(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();

    if (!settings) {
      throw new Error("Settings not initialized");
    }

    await ctx.db.patch(settings._id, {
      examSeasonEndAt: args.examSeasonEndAt,
    });

    await ctx.db.insert("auditLog", {
      adminEmail: adminEmail,
      action: "settings.updateSeasonEnd",
      targetType: "settings",
      targetId: settings._id,
      metadata: JSON.stringify({ examSeasonEndAt: args.examSeasonEndAt }),
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    adminSecret: v.string(),
    proPriceEtb: v.number(),
    examSeasonEndAt: v.number(),
    paymentInstructionsAm: v.string(),
    paymentInstructionsEn: v.string(),
    telebirrNumber: v.optional(v.string()),
    cbeNumber: v.optional(v.string()),
    telebirrName: v.optional(v.string()),
    cbeName: v.optional(v.string()),
    freeMockLimitPerMonth: v.number(),
    freeDailyQuestionCap: v.number(),
    allowManualMarkEntry: v.boolean(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();

    if (!settings) {
      throw new Error("Settings not initialized");
    }

    await ctx.db.patch(settings._id, {
      proPriceEtb: args.proPriceEtb,
      examSeasonEndAt: args.examSeasonEndAt,
      paymentInstructionsAm: args.paymentInstructionsAm,
      paymentInstructionsEn: args.paymentInstructionsEn,
      telebirrNumber: args.telebirrNumber?.trim() || undefined,
      cbeNumber: args.cbeNumber?.trim() || undefined,
      telebirrName: args.telebirrName?.trim() || undefined,
      cbeName: args.cbeName?.trim() || undefined,
      freeMockLimitPerMonth: args.freeMockLimitPerMonth,
      freeDailyQuestionCap: args.freeDailyQuestionCap,
      allowManualMarkEntry: args.allowManualMarkEntry,
    });

    await ctx.db.insert("auditLog", {
      adminEmail: adminEmail,
      action: "settings.update",
      targetType: "settings",
      targetId: settings._id,
      createdAt: Date.now(),
    });
  },
});
