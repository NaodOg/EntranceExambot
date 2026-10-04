import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { mutation, query } from "./_generated/server";

const namespaceValidator = v.union(v.literal("app"), v.literal("bot"));

const overrideValidator = v.object({
  namespace: namespaceValidator,
  key: v.string(),
  textEn: v.string(),
  textAm: v.string(),
});

export const getOverrides = query({
  args: {},
  returns: v.array(overrideValidator),
  handler: async (ctx) => {
    const rows = await ctx.db.query("translationOverrides").collect();
    return rows.map((row) => ({
      namespace: row.namespace,
      key: row.key,
      textEn: row.textEn,
      textAm: row.textAm,
    }));
  },
});

export const setOverride = mutation({
  args: {
    adminSecret: v.string(),
    namespace: namespaceValidator,
    key: v.string(),
    textEn: v.string(),
    textAm: v.string(),
    adminEmail: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const existing = await ctx.db
      .query("translationOverrides")
      .withIndex("by_namespace_key", (q) =>
        q.eq("namespace", args.namespace).eq("key", args.key),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        textEn: args.textEn,
        textAm: args.textAm,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("translationOverrides", {
        namespace: args.namespace,
        key: args.key,
        textEn: args.textEn,
        textAm: args.textAm,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("auditLog", {
      adminEmail: adminEmail,
      action: "translation.set",
      targetType: "translationOverrides",
      targetId: `${args.namespace}:${args.key}`,
      metadata: JSON.stringify({ key: args.key, namespace: args.namespace }),
      createdAt: Date.now(),
    });

    return null;
  },
});

export const resetOverride = mutation({
  args: {
    adminSecret: v.string(),
    namespace: namespaceValidator,
    key: v.string(),
    adminEmail: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const existing = await ctx.db
      .query("translationOverrides")
      .withIndex("by_namespace_key", (q) =>
        q.eq("namespace", args.namespace).eq("key", args.key),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.insert("auditLog", {
        adminEmail: adminEmail,
        action: "translation.reset",
        targetType: "translationOverrides",
        targetId: `${args.namespace}:${args.key}`,
        createdAt: Date.now(),
      });
    }

    return null;
  },
});
