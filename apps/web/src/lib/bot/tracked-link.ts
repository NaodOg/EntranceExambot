import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { api } from "convex/_generated/api";
import { buildMiniAppLink } from "@/lib/bot-links";
import { t } from "./copy";
import { ensureProfile } from "./convex";
import { maybeOnboard, sendMainMenu } from "./onboarding";
import { appUrls } from "./urls";

/** Handles `/start link_<CODE>` for admin-created tracked links. */
export async function sendTrackedLinkStart(ctx: Context, code: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const resolved = await session.convex.mutation(api.links.recordStart, {
    telegramId: session.telegramId,
    code,
  });

  if (!resolved.ok) {
    await maybeOnboard(ctx);
    return;
  }

  const c = t(session.lang);
  const keyboard = new InlineKeyboard();

  if (resolved.target === "url" && resolved.url) {
    keyboard.url(c.openLink, resolved.url);
  } else if (resolved.target === "app") {
    if (resolved.startParam) {
      keyboard.url(c.openApp, buildMiniAppLink(resolved.startParam));
    } else {
      const base = appUrls.home().replace(/\/$/, "");
      keyboard.webApp(c.openApp, `${base}${resolved.path ?? ""}`);
    }
  }

  await ctx.reply(c.trackedLinkInvite, {
    reply_markup: keyboard.inline_keyboard.length ? keyboard : undefined,
  });

  if (!session.profile.onboardingComplete) {
    await maybeOnboard(ctx);
  } else if (resolved.target === "bot") {
    await sendMainMenu(ctx, session.lang, session.profile.firstName);
  }
}
