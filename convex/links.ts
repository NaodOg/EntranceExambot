import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin, resolveTelegramId } from "./lib/auth";
import { mutation, query, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const TARGET = v.union(v.literal("app"), v.literal("bot"), v.literal("url"));

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 7): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

async function uniqueCode(ctx: MutationCtx, requested?: string): Promise<string> {
  if (requested) {
    const code = normalizeCode(requested);
    if (code.length < 3) throw new Error("Code must be at least 3 characters");
    const existing = await ctx.db
      .query("trackedLinks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (existing) throw new Error("That code is already in use");
    return code;
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateCode();
    const existing = await ctx.db
      .query("trackedLinks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!existing) return code;
  }
  throw new Error("Could not allocate a unique code, try again");
}

function validateTarget(target: "app" | "bot" | "url", path?: string, url?: string, startParam?: string) {
  if (target === "app" && path && !path.startsWith("/")) {
    throw new Error("App path must start with /");
  }
  if (target === "url") {
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error("A valid http(s) URL is required");
    }
  }
  if (target === "app" && startParam && /[^A-Za-z0-9_-]/.test(startParam)) {
    throw new Error("Start param may only contain letters, numbers, _ and -");
  }
}

async function recordEvent(
  ctx: MutationCtx,
  link: Doc<"trackedLinks">,
  kind: "start" | "signup",
  extra: { telegramId?: string; userId?: Doc<"users">["_id"] },
) {
  const now = Date.now();
  await ctx.db.insert("linkEvents", {
    linkId: link._id,
    code: link.code,
    kind,
    telegramId: extra.telegramId,
    userId: extra.userId,
    createdAt: now,
  });
  return now;
}

/** Attribution helper: called when a user completes onboarding. */
export async function attributeSignup(ctx: MutationCtx, user: Doc<"users">) {
  const code = user.acquiredLinkCode;
  if (!code) return;
  const link = await ctx.db
    .query("trackedLinks")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
  if (!link) return;

  const prior = await ctx.db
    .query("linkEvents")
    .withIndex("by_link_telegram", (q) =>
      q.eq("linkId", link._id).eq("telegramId", user.telegramId),
    )
    .collect();
  if (prior.some((event) => event.kind === "signup")) {
    return;
  }

  const now = await recordEvent(ctx, link, "signup", {
    telegramId: user.telegramId,
    userId: user._id,
  });
  await ctx.db.patch(link._id, { signups: link.signups + 1, lastEventAt: now });
}

/* ------------------------------------------------------------------ admin */

export const list = query({
  args: {
    adminSecret: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    return await ctx.db
      .query("trackedLinks")
      .withIndex("by_created")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const overview = query({
  args: { adminSecret: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const links = await ctx.db.query("trackedLinks").collect();
    return {
      total: links.length,
      active: links.filter((link) => link.isActive).length,
      starts: links.reduce((sum, link) => sum + link.starts, 0),
      uniqueUsers: links.reduce((sum, link) => sum + link.uniqueUsers, 0),
      signups: links.reduce((sum, link) => sum + link.signups, 0),
    };
  },
});

export const get = query({
  args: {
    adminSecret: v.string(),
    id: v.id("trackedLinks"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const link = await ctx.db.get(args.id);
    if (!link) return null;
    const events = await ctx.db
      .query("linkEvents")
      .withIndex("by_link_created", (q) => q.eq("linkId", args.id))
      .order("desc")
      .take(Math.min(args.limit ?? 40, 200));
    return { link, events };
  },
});

export const create = mutation({
  args: {
    adminSecret: v.string(),
    adminEmail: v.string(),
    label: v.string(),
    code: v.optional(v.string()),
    target: TARGET,
    path: v.optional(v.string()),
    url: v.optional(v.string()),
    startParam: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const label = args.label.trim();
    if (!label) throw new Error("A label is required");
    validateTarget(args.target, args.path, args.url, args.startParam);
    const code = await uniqueCode(ctx, args.code);

    const id = await ctx.db.insert("trackedLinks", {
      code,
      label,
      target: args.target,
      path: args.path?.trim() || undefined,
      url: args.url?.trim() || undefined,
      startParam: args.startParam?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      isActive: args.isActive ?? true,
      starts: 0,
      uniqueUsers: 0,
      signups: 0,
      createdBy: adminEmail,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      adminEmail,
      action: "link.create",
      targetType: "trackedLinks",
      targetId: id,
      metadata: code,
      createdAt: Date.now(),
    });
    return { id, code };
  },
});

export const update = mutation({
  args: {
    adminSecret: v.string(),
    adminEmail: v.string(),
    id: v.id("trackedLinks"),
    label: v.optional(v.string()),
    target: v.optional(TARGET),
    path: v.optional(v.string()),
    url: v.optional(v.string()),
    startParam: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Link not found");

    const target = args.target ?? link.target;
    const path = args.path !== undefined ? args.path : link.path;
    const url = args.url !== undefined ? args.url : link.url;
    const startParam = args.startParam !== undefined ? args.startParam : link.startParam;
    validateTarget(target, path, url, startParam);

    const patch: Record<string, unknown> = { target };
    if (args.label !== undefined) {
      if (!args.label.trim()) throw new Error("A label is required");
      patch.label = args.label.trim();
    }
    patch.path = path?.trim() || undefined;
    patch.url = url?.trim() || undefined;
    patch.startParam = startParam?.trim() || undefined;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.id, patch);
    await ctx.db.insert("auditLog", {
      adminEmail,
      action: "link.update",
      targetType: "trackedLinks",
      targetId: args.id,
      createdAt: Date.now(),
    });
    return args.id;
  },
});

export const setActive = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("trackedLinks"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Link not found");
    await ctx.db.patch(args.id, { isActive: args.isActive });
    return args.id;
  },
});

export const remove = mutation({
  args: {
    adminSecret: v.string(),
    adminEmail: v.string(),
    id: v.id("trackedLinks"),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Link not found");

    const events = await ctx.db
      .query("linkEvents")
      .withIndex("by_link", (q) => q.eq("linkId", args.id))
      .collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      adminEmail,
      action: "link.delete",
      targetType: "trackedLinks",
      targetId: args.id,
      metadata: link.code,
      createdAt: Date.now(),
    });
    return args.id;
  },
});

/* --------------------------------------------------------------- tracking */

/** Bot `/start link_<CODE>` hit. Requires a trusted bot proof. */
export const recordStart = mutation({
  args: {
    telegramId: v.string(),
    code: v.string(),
    initData: v.optional(v.string()),
    botProof: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const telegramId = await resolveTelegramId(args);
    const code = normalizeCode(args.code);
    const link = await ctx.db
      .query("trackedLinks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!link || !link.isActive) return { ok: false as const };

    const user = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();

    const prior = await ctx.db
      .query("linkEvents")
      .withIndex("by_link_telegram", (q) => q.eq("linkId", link._id).eq("telegramId", telegramId))
      .first();
    const isNew = !prior;

    const now = await recordEvent(ctx, link, "start", {
      telegramId,
      userId: user?._id,
    });
    await ctx.db.patch(link._id, {
      starts: link.starts + 1,
      uniqueUsers: link.uniqueUsers + (isNew ? 1 : 0),
      lastEventAt: now,
    });

    if (user && !user.acquiredLinkCode) {
      await ctx.db.patch(user._id, { acquiredLinkCode: link.code, acquiredAt: now });
    }

    return {
      ok: true as const,
      target: link.target,
      path: link.path,
      url: link.url,
      startParam: link.startParam,
      code: link.code,
      label: link.label,
    };
  },
});
