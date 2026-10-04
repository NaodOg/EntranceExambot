import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { fill, t, type Lang } from "./copy";
import { ensureProfile } from "./convex";
import {
  handleGroupDuelCallback,
  isGroupDuelCallback,
  sendGroupDuelMenu,
  sendGroupStart,
} from "./group-duel";

export function isGroupChat(ctx: Context): boolean {
  const type = ctx.chat?.type;
  return type === "group" || type === "supergroup";
}

export function privateChatUrl(username: string, startParam?: string): string {
  const base = `https://t.me/${username}`;
  if (!startParam) return base;
  return `${base}?start=${encodeURIComponent(startParam)}`;
}

function dmStartParam(ctx: Context): string | undefined {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return undefined;
  return `group_${chatId}`;
}

export async function resolveGroupLang(ctx: Context): Promise<Lang> {
  if (!ctx.from) return "en";
  try {
    const session = await ensureProfile(ctx.from);
    return session.lang;
  } catch {
    return "en";
  }
}

/** HTML attribute-safe for href (Telegram uses HTML parse mode). */
function escHtmlAttr(url: string): string {
  return url
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendGroupUsePrivate(ctx: Context, lang?: Lang) {
  const username = ctx.me?.username;
  if (!username) return;
  const resolved = lang ?? (await resolveGroupLang(ctx));
  const c = t(resolved);
  const dmLink = privateChatUrl(username, dmStartParam(ctx));
  const keyboard = new InlineKeyboard().url(c.groupOpenPrivate, dmLink);
  await ctx.reply(fill(c.groupUsePrivate, { dmLink: escHtmlAttr(dmLink) }), {
    parse_mode: "HTML",
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  });
}

export async function sendGroupHelp(ctx: Context, lang: Lang) {
  await ctx.reply(t(lang).groupHelp, { parse_mode: "HTML" });
}

function parseCommand(text: string, botUsername?: string): string {
  const first = text.trim().split(/\s+/)[0] ?? "";
  let cmd = first.startsWith("/") ? first.slice(1) : first;
  const at = cmd.indexOf("@");
  if (at !== -1) {
    const mention = cmd.slice(at + 1).toLowerCase();
    cmd = cmd.slice(0, at);
    if (botUsername && mention !== botUsername.toLowerCase()) {
      return "";
    }
  }
  return cmd.toLowerCase();
}

const GROUP_COMMANDS = new Set(["start", "duel", "help"]);

export async function handleGroupMessage(ctx: Context): Promise<boolean> {
  if (!isGroupChat(ctx)) return false;

  if (ctx.callbackQuery) {
    const data = ctx.callbackQuery.data;
    if (isGroupDuelCallback(data)) {
      await handleGroupDuelCallback(ctx, data ?? "");
      return true;
    }
    const lang = await resolveGroupLang(ctx);
    await ctx.answerCallbackQuery({
      text: t(lang).groupCallbackAlert,
      show_alert: true,
    });
    return true;
  }

  if (ctx.message?.photo) {
    return true;
  }

  const text = ctx.message?.text;
  if (!text) {
    return true;
  }

  if (!text.startsWith("/")) {
    return true;
  }

  // Ignore commands addressed to a different bot (e.g. /foo@OtherBot).
  const firstToken = text.trim().split(/\s+/)[0] ?? "";
  const at = firstToken.indexOf("@");
  if (at !== -1) {
    const mention = firstToken.slice(at + 1).toLowerCase();
    if (mention !== (ctx.me?.username ?? "").toLowerCase()) {
      return true;
    }
  }

  const cmd = parseCommand(text, ctx.me?.username);
  if (!cmd || !GROUP_COMMANDS.has(cmd)) {
    await sendGroupUsePrivate(ctx);
    return true;
  }

  if (cmd === "start") {
    if (!ctx.from) return true;
    await ensureProfile(ctx.from);
    await sendGroupStart(ctx);
    return true;
  }
  if (cmd === "duel") {
    await sendGroupDuelMenu(ctx);
    return true;
  }
  if (cmd === "help") {
    const lang = await resolveGroupLang(ctx);
    await sendGroupHelp(ctx, lang);
    return true;
  }

  return true;
}

export async function handleBotAddedToGroup(ctx: Context) {
  if (!isGroupChat(ctx)) return;
  const update = ctx.myChatMember;
  if (!update) return;

  const newStatus = update.new_chat_member.status;
  const oldStatus = update.old_chat_member.status;
  const botId = ctx.me?.id;
  if (!botId || update.new_chat_member.user.id !== botId) return;

  const joined =
    (newStatus === "member" || newStatus === "administrator") &&
    (oldStatus === "left" || oldStatus === "kicked");
  if (!joined) return;

  await sendGroupStart(ctx);
}
