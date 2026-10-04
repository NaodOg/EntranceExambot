import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { getActiveDisplayStreak } from "./streak";
import {
  broadcastAudienceValidator,
  broadcastButtonValidator,
  broadcastScheduleKindValues,
  broadcastStatusValues,
} from "./schema";
import {
  hasBotToken,
  tgSendMessage,
  type TgInlineKeyboard,
} from "./lib/telegram";

const dayMs = 24 * 60 * 60 * 1000;
/** Max recipients attempted per scheduled tick before yielding and rescheduling. */
const MAX_PER_TICK = 700;
/** Delay before a continuation tick resumes a large run or a rate-limited run. */
const CONTINUATION_DELAY_MS = 20_000;

type Audience = {
  all: boolean;
  tracks: string[];
  pro: "any" | "pro" | "free";
  languages: Array<"en" | "am">;
  activeWithinDays?: number;
  inactiveForDays?: number;
  minStreak?: number;
  maxStreak?: number;
  telegramIds: string[];
};

type Recipient = {
  telegramId: string;
  name: string;
  language: "en" | "am";
  streak: number;
  xp: number;
  trackSlug: string;
  trackName: string;
  subjectName: string;
};

function isProActive(user: Doc<"users">, now: number): boolean {
  return Boolean(user.isPro && (!user.proExpiresAt || user.proExpiresAt > now));
}

async function resolveTrackName(
  db: QueryCtx["db"],
  trackSlug: string,
  language: string | undefined,
): Promise<string> {
  if (!trackSlug) return "";
  const track = await db
    .query("tracks")
    .withIndex("by_slug", (q) => q.eq("slug", trackSlug))
    .unique();
  if (!track) return trackSlug;
  return language === "am" ? track.nameAm || track.nameEn : track.nameEn;
}

/** First saved subject that still exists in the catalog. */
async function resolveSubjectName(
  db: QueryCtx["db"],
  subjectSlugs: string[] | undefined,
  language: string | undefined,
): Promise<string> {
  for (const slug of subjectSlugs ?? []) {
    const subject = await db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (subject) {
      return language === "am" ? subject.nameAm || subject.nameEn : subject.nameEn;
    }
  }
  return "";
}

async function recipientOf(
  db: QueryCtx["db"],
  user: Doc<"users">,
  now: number,
): Promise<Recipient> {
  const language = user.language === "am" ? "am" : "en";
  return {
    telegramId: user.telegramId,
    name: user.firstName ?? user.username ?? "Student",
    language,
    streak: getActiveDisplayStreak(user, now),
    xp: user.xp,
    trackSlug: user.trackSlug ?? "",
    trackName: await resolveTrackName(db, user.trackSlug ?? "", language),
    subjectName: await resolveSubjectName(db, user.subjectSlugs, language),
  };
}

function matchesAudience(user: Doc<"users">, audience: Audience, now: number): boolean {
  if (audience.all) return true;

  if (
    audience.tracks.length > 0 &&
    !audience.tracks.includes(user.trackSlug ?? "")
  ) {
    return false;
  }

  const pro = isProActive(user, now);
  if (audience.pro === "pro" && !pro) return false;
  if (audience.pro === "free" && pro) return false;

  if (audience.languages.length > 0 && !audience.languages.includes(user.language)) {
    return false;
  }

  if (audience.activeWithinDays != null) {
    if ((user.lastActiveAt ?? 0) < now - audience.activeWithinDays * dayMs) return false;
  }
  if (audience.inactiveForDays != null) {
    if ((user.lastActiveAt ?? 0) > now - audience.inactiveForDays * dayMs) return false;
  }

  const streak = getActiveDisplayStreak(user, now);
  if (audience.minStreak != null && streak < audience.minStreak) return false;
  if (audience.maxStreak != null && streak > audience.maxStreak) return false;

  return true;
}

function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(vars[key] ?? ""));
}

function renderBody(
  bc: Pick<Doc<"broadcasts">, "bodyEn" | "bodyAm">,
  recipient: Recipient,
): string {
  const template = recipient.language === "am" ? bc.bodyAm : bc.bodyEn;
  return render(template, {
    name: recipient.name,
    firstName: recipient.name.split(" ")[0] ?? recipient.name,
    streak: recipient.streak,
    xp: recipient.xp,
    track: recipient.trackName,
    subject: recipient.subjectName,
    // Legacy alias: broadcasts saved before the track rename still render.
    dept: recipient.trackName,
  });
}

type StoredButton = Doc<"broadcasts">["buttons"][number];

/**
 * Resolves a Mini App button target. Admins pick web app destinations as
 * in-app paths (e.g. "/exam") or the "home" alias, which get prefixed with
 * the Mini App base URL. Full https:// URLs are passed through untouched.
 */
function resolveMiniAppUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const base = (
    process.env.NEXT_PUBLIC_MINI_APP_URL ?? "http://localhost:3000/app"
  ).replace(/\/+$/, "");
  if (value === "home") return base;
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

function buildKeyboard(buttons: StoredButton[], lang: "en" | "am"): TgInlineKeyboard {
  const rows = new Map<number, TgInlineKeyboard[number]>();
  for (const button of [...buttons].sort((a, b) => a.row - b.row)) {
    const label = (lang === "am" ? button.labelAm : button.labelEn).trim();
    if (!label) continue;
    const value = button.value.trim();
    if (!value) continue;

    let inline: TgInlineKeyboard[number][number];
    if (button.action === "url") {
      inline = { text: label, url: value };
    } else if (button.action === "mini_app") {
      inline = { text: label, web_app: { url: resolveMiniAppUrl(value) } };
    } else if (button.action === "menu") {
      inline = { text: label, callback_data: `m:${value}` };
    } else {
      inline = { text: label, callback_data: value };
    }

    const row = rows.get(button.row) ?? [];
    row.push(inline);
    rows.set(button.row, row);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row).slice(0, 10);
}

async function audit(
  ctx: MutationCtx,
  adminEmail: string,
  action: string,
  targetId: string,
  metadata?: string,
) {
  await ctx.db.insert("auditLog", {
    adminEmail,
    action,
    targetType: "broadcast",
    targetId,
    metadata,
    createdAt: Date.now(),
  });
}

type AudienceCount = {
  count: number;
  samples: Recipient[];
  pro: number;
  byLanguage: { en: number; am: number };
  truncated: boolean;
};

/** Upper bound on users inspected for a preview (single query, so no re-paginate). */
const PREVIEW_SCAN_CAP = 5000;

async function countAudience(
  ctx: QueryCtx,
  audience: Audience,
  now: number,
): Promise<AudienceCount> {
  const samples: Recipient[] = [];
  let count = 0;
  let pro = 0;
  const byLanguage = { en: 0, am: 0 };

  const receiver = async (users: Doc<"users">[]) => {
    for (const user of users) {
      if (!user.telegramId) continue;
      const matches =
        audience.telegramIds.length > 0
          ? audience.telegramIds.includes(user.telegramId)
          : matchesAudience(user, audience, now);
      if (!matches) continue;
      count += 1;
      if (isProActive(user, now)) pro += 1;
      if (user.language === "am") byLanguage.am += 1;
      else byLanguage.en += 1;
      if (samples.length < 5) samples.push(await recipientOf(ctx.db, user, now));
    }
  };

  if (audience.telegramIds.length > 0) {
    for (const telegramId of audience.telegramIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
        .unique();
      if (user) await receiver([user]);
    }
    return { count, samples, pro, byLanguage, truncated: false };
  }

  // Single bounded read: Convex only allows one paginated query per function,
  // so we cannot loop `.paginate()` here. `.take()` keeps it to one query.
  const users = await ctx.db.query("users").take(PREVIEW_SCAN_CAP);
  await receiver(users);

  return {
    count,
    samples,
    pro,
    byLanguage,
    truncated: users.length >= PREVIEW_SCAN_CAP,
  };
}

/* ------------------------------------------------------------------ queries */

export const list = query({
  args: {
    adminSecret: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const result = await ctx.db
      .query("broadcasts")
      .order("desc")
      .paginate(args.paginationOpts);
    return result;
  },
});

export const get = query({
  args: { adminSecret: v.string(), id: v.id("broadcasts") },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    return await ctx.db.get(args.id);
  },
});

export const runs = query({
  args: { adminSecret: v.string(), broadcastId: v.id("broadcasts") },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    return await ctx.db
      .query("broadcastRuns")
      .withIndex("by_broadcast", (q) => q.eq("broadcastId", args.broadcastId))
      .order("desc")
      .take(20);
  },
});

export const previewAudience = query({
  args: {
    adminSecret: v.string(),
    audience: broadcastAudienceValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    return await countAudience(ctx, args.audience as Audience, Date.now());
  },
});

/* ---------------------------------------------------------------- mutations */

export const save = mutation({
  args: {
    adminSecret: v.string(),
    adminEmail: v.string(),
    id: v.optional(v.id("broadcasts")),
    name: v.string(),
    bodyEn: v.string(),
    bodyAm: v.string(),
    buttons: v.array(broadcastButtonValidator),
    audience: broadcastAudienceValidator,
    scheduleKind: broadcastScheduleKindValues,
    startAt: v.optional(v.number()),
    intervalMinutes: v.optional(v.number()),
    endAt: v.optional(v.number()),
    start: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const name = args.name.trim();
    if (!name) throw new Error("Give the broadcast a name");
    if (!args.bodyEn.trim() && !args.bodyAm.trim()) {
      throw new Error("Write a message first");
    }

    const now = Date.now();
    const shouldStart = args.start === true;
    const nextRunAt = shouldStart
      ? args.scheduleKind === "once" || args.scheduleKind === "recurring"
        ? args.startAt ?? now
        : now
      : undefined;

    const base = {
      name,
      bodyEn: args.bodyEn,
      bodyAm: args.bodyAm,
      buttons: args.buttons,
      audience: args.audience,
      scheduleKind: args.scheduleKind,
      startAt: args.startAt,
      intervalMinutes: args.intervalMinutes,
      endAt: args.endAt,
      nextRunAt,
      status: shouldStart ? ("scheduled" as const) : ("draft" as const),
      cursor: undefined,
      ticking: false,
      updatedAt: now,
      lastError: undefined,
    };

    let broadcastId: Id<"broadcasts">;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Broadcast not found");
      await ctx.db.patch(args.id, base);
      broadcastId = args.id;
    } else {
      broadcastId = await ctx.db.insert("broadcasts", {
        ...base,
        runCount: 0,
        sentCount: 0,
        failedCount: 0,
        createdBy: args.adminEmail || adminEmail,
        createdAt: now,
      });
    }

    if (shouldStart) {
      await ctx.scheduler.runAt(
        Math.max(nextRunAt ?? now, now),
        internal.broadcasts.sendBroadcast,
        { broadcastId },
      );
    }

    await audit(
      ctx,
      adminEmail,
      args.id ? "broadcast.update" : "broadcast.create",
      broadcastId,
      JSON.stringify({ name, scheduleKind: args.scheduleKind, started: shouldStart }),
    );

    return broadcastId;
  },
});

export const sendNow = mutation({
  args: {
    adminSecret: v.string(),
    adminEmail: v.string(),
    id: v.id("broadcasts"),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Broadcast not found");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "scheduled",
      nextRunAt: now,
      cursor: undefined,
      ticking: false,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.broadcasts.sendBroadcast, {
      broadcastId: args.id,
    });
    await audit(ctx, adminEmail, "broadcast.sendNow", args.id, undefined);
  },
});

export const pause = mutation({
  args: { adminSecret: v.string(), adminEmail: v.string(), id: v.id("broadcasts") },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() });
    await audit(ctx, adminEmail, "broadcast.pause", args.id, undefined);
  },
});

export const resume = mutation({
  args: { adminSecret: v.string(), adminEmail: v.string(), id: v.id("broadcasts") },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const now = Date.now();
    await ctx.db.patch(args.id, { status: "scheduled", nextRunAt: now, ticking: false, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.broadcasts.sendBroadcast, { broadcastId: args.id });
    await audit(ctx, adminEmail, "broadcast.resume", args.id, undefined);
  },
});

export const cancel = mutation({
  args: { adminSecret: v.string(), adminEmail: v.string(), id: v.id("broadcasts") },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    await ctx.db.patch(args.id, {
      status: "cancelled",
      nextRunAt: undefined,
      ticking: false,
      updatedAt: Date.now(),
    });
    await audit(ctx, adminEmail, "broadcast.cancel", args.id, undefined);
  },
});

export const remove = mutation({
  args: { adminSecret: v.string(), adminEmail: v.string(), id: v.id("broadcasts") },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const runRows = await ctx.db
      .query("broadcastRuns")
      .withIndex("by_broadcast", (q) => q.eq("broadcastId", args.id))
      .collect();
    for (const row of runRows) await ctx.db.delete(row._id);
    await ctx.db.delete(args.id);
    await audit(ctx, adminEmail, "broadcast.remove", args.id, undefined);
  },
});

export const duplicate = mutation({
  args: { adminSecret: v.string(), adminEmail: v.string(), id: v.id("broadcasts") },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Broadcast not found");
    const now = Date.now();
    const copyId = await ctx.db.insert("broadcasts", {
      name: `${existing.name} (copy)`,
      bodyEn: existing.bodyEn,
      bodyAm: existing.bodyAm,
      buttons: existing.buttons,
      audience: existing.audience,
      scheduleKind: "now",
      startAt: undefined,
      intervalMinutes: existing.intervalMinutes,
      endAt: existing.endAt,
      status: "draft",
      nextRunAt: undefined,
      lastRunAt: undefined,
      runCount: 0,
      sentCount: 0,
      failedCount: 0,
      lastError: undefined,
      cursor: undefined,
      ticking: false,
      lastTickAt: undefined,
      currentRunId: undefined,
      createdBy: args.adminEmail || adminEmail,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, adminEmail, "broadcast.duplicate", copyId, `from ${args.id}`);
    return copyId;
  },
});

/* ------------------------------------------------------------------ actions */

export const sendTest = action({
  args: {
    adminSecret: v.string(),
    chatId: v.string(),
    bodyEn: v.string(),
    bodyAm: v.string(),
    lang: v.union(v.literal("en"), v.literal("am")),
    buttons: v.array(broadcastButtonValidator),
  },
  handler: async (_ctx, args) => {
    await requireAdmin(args.adminSecret);
    if (!hasBotToken()) {
      return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured for Convex" };
    }
    const recipient: Recipient = {
      telegramId: args.chatId,
      name: "Preview",
      language: args.lang,
      streak: 5,
      xp: 120,
      trackSlug: "natural-science",
      trackName: "Natural Science",
      subjectName: "Physics",
    };
    const text = renderBody({ bodyEn: args.bodyEn, bodyAm: args.bodyAm }, recipient);
    const keyboard = buildKeyboard(args.buttons as StoredButton[], args.lang);
    const result = await tgSendMessage({
      chatId: args.chatId,
      text: text || "(empty message)",
      inlineKeyboard: keyboard,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.description };
  },
});

export const sendBroadcast = internalAction({
  args: { broadcastId: v.id("broadcasts") },
  handler: async (ctx, { broadcastId }) => {
    const bc = await ctx.runQuery(internal.broadcasts.getInternal, { broadcastId });
    if (!bc) return;
    if (bc.status === "cancelled" || bc.status === "paused" || bc.status === "draft") {
      return;
    }
    if (bc.status === "sent" || bc.status === "failed") return;

    if (!hasBotToken()) {
      await ctx.runMutation(internal.broadcasts.markFailed, {
        broadcastId,
        error: "TELEGRAM_BOT_TOKEN is not configured for Convex",
      });
      return;
    }

    const claimed = await ctx.runMutation(internal.broadcasts.claimTick, { broadcastId });
    if (!claimed) return;

    const freshRun = bc.cursor == null;
    if (freshRun) {
      await ctx.runMutation(internal.broadcasts.beginRun, { broadcastId });
    }

    let sent = 0;
    let failed = 0;
    let cursor: string | null = bc.cursor ?? null;
    let isDone = false;
    let lastError: string | undefined;
    let attempted = 0;
    let retryAfterMs = 0;

    try {
      while (!isDone && attempted < MAX_PER_TICK) {
        const batch = await ctx.runQuery(internal.broadcasts.recipientsBatch, {
          broadcastId,
          paginationOpts: { numItems: 50, cursor },
        });

        let rateLimited = false;
        for (const recipient of batch.page) {
          attempted += 1;
          const text = renderBody(bc, recipient);
          const keyboard = buildKeyboard(bc.buttons, recipient.language);
          const result = await tgSendMessage({
            chatId: recipient.telegramId,
            text,
            inlineKeyboard: keyboard,
            disablePreview: true,
          });
          if (result.ok) {
            sent += 1;
          } else {
            failed += 1;
            if (result.description && !lastError) lastError = result.description;
            if (result.retryAfter) {
              retryAfterMs = (result.retryAfter + 1) * 1000;
              rateLimited = true;
              break;
            }
          }
        }

        // On a rate limit, stop before advancing the cursor so the batch is
        // retried after the cooldown (a few recipients may repeat).
        if (rateLimited) break;
        cursor = batch.continueCursor;
        isDone = batch.isDone;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Broadcast send failed";
    }

    const now = Date.now();
    const intervalMs = (bc.intervalMinutes ?? 0) * 60_000;
    let status: "sending" | "scheduled" | "sent";
    let nextRunAt: number | undefined;
    let schedule = false;

    if (!isDone) {
      status = "sending";
      nextRunAt = now + (retryAfterMs > 0 ? retryAfterMs : CONTINUATION_DELAY_MS);
      schedule = true;
    } else if (bc.scheduleKind === "recurring" && intervalMs > 0) {
      let next = now + intervalMs;
      if (bc.endAt != null && next > bc.endAt) {
        status = "sent";
        nextRunAt = undefined;
      } else {
        status = "scheduled";
        nextRunAt = next;
        schedule = true;
      }
    } else {
      status = "sent";
      nextRunAt = undefined;
    }

    await ctx.runMutation(internal.broadcasts.completeTick, {
      broadcastId,
      sent,
      failed,
      cursor: isDone ? undefined : cursor ?? undefined,
      isDone,
      lastError,
      status,
      nextRunAt,
    });

    if (schedule && nextRunAt != null) {
      await ctx.scheduler.runAt(nextRunAt, internal.broadcasts.sendBroadcast, {
        broadcastId,
      });
    }
  },
});

/* ----------------------------------------------------------------- internal */

export const getInternal = internalQuery({
  args: { broadcastId: v.id("broadcasts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.broadcastId);
  },
});

export const recipientsBatch = internalQuery({
  args: {
    broadcastId: v.id("broadcasts"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const bc = await ctx.db.get(args.broadcastId);
    if (!bc) {
      return { page: [] as Recipient[], continueCursor: "", isDone: true };
    }
    const audience = bc.audience as Audience;
    const now = Date.now();

    if (audience.telegramIds.length > 0) {
      const recipients: Recipient[] = [];
      for (const telegramId of audience.telegramIds) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
          .unique();
        if (user) recipients.push(await recipientOf(ctx.db, user, now));
      }
      return { page: recipients, continueCursor: "", isDone: true };
    }

    const result = await ctx.db.query("users").paginate(args.paginationOpts);
    return {
      page: await Promise.all(
        result.page
          .filter((user) => matchesAudience(user, audience, now))
          .map((user) => recipientOf(ctx.db, user, now)),
      ),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const claimTick = internalMutation({
  args: { broadcastId: v.id("broadcasts") },
  handler: async (ctx, args) => {
    const bc = await ctx.db.get(args.broadcastId);
    if (!bc) return false;
    if (
      bc.status === "cancelled" ||
      bc.status === "paused" ||
      bc.status === "draft" ||
      bc.status === "sent" ||
      bc.status === "failed"
    ) {
      return false;
    }
    const now = Date.now();
    if (bc.ticking && bc.lastTickAt && now - bc.lastTickAt < 5 * 60_000) {
      return false;
    }
    await ctx.db.patch(args.broadcastId, { ticking: true, lastTickAt: now });
    return true;
  },
});

export const beginRun = internalMutation({
  args: { broadcastId: v.id("broadcasts") },
  handler: async (ctx, args) => {
    const bc = await ctx.db.get(args.broadcastId);
    if (!bc) return;
    const runId = await ctx.db.insert("broadcastRuns", {
      broadcastId: args.broadcastId,
      startedAt: Date.now(),
      sent: 0,
      failed: 0,
    });
    await ctx.db.patch(args.broadcastId, {
      currentRunId: runId,
      runCount: bc.runCount + 1,
      cursor: undefined,
    });
  },
});

export const completeTick = internalMutation({
  args: {
    broadcastId: v.id("broadcasts"),
    sent: v.number(),
    failed: v.number(),
    cursor: v.optional(v.string()),
    isDone: v.boolean(),
    lastError: v.optional(v.string()),
    status: broadcastStatusValues,
    nextRunAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const bc = await ctx.db.get(args.broadcastId);
    if (!bc) return;

    await ctx.db.patch(args.broadcastId, {
      sentCount: bc.sentCount + args.sent,
      failedCount: bc.failedCount + args.failed,
      ticking: false,
      lastTickAt: Date.now(),
      updatedAt: Date.now(),
      status: args.status,
      nextRunAt: args.nextRunAt,
      cursor: args.isDone ? undefined : args.cursor,
      lastError: args.lastError ?? bc.lastError,
      ...(args.isDone ? { lastRunAt: Date.now() } : {}),
    });

    if (bc.currentRunId) {
      const run = await ctx.db.get(bc.currentRunId);
      if (run) {
        await ctx.db.patch(bc.currentRunId, {
          sent: run.sent + args.sent,
          failed: run.failed + args.failed,
          error: args.lastError ?? run.error,
          ...(args.isDone ? { completedAt: Date.now() } : {}),
        });
      }
      if (args.isDone) {
        await ctx.db.patch(args.broadcastId, { currentRunId: undefined });
      }
    }
  },
});

export const markFailed = internalMutation({
  args: { broadcastId: v.id("broadcasts"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.broadcastId, {
      status: "failed",
      lastError: args.error,
      ticking: false,
      nextRunAt: undefined,
      updatedAt: Date.now(),
    });
  },
});
