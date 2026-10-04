import type { Context } from "grammy";
import type { InlineKeyboard } from "grammy";

export type BotScreen = {
  text: string;
  keyboard?: InlineKeyboard;
};

function isNotModified(error: unknown): boolean {
  return error instanceof Error && /not modified/i.test(error.message);
}

/**
 * Renders a screen. When the update comes from an inline button, the message
 * that owns that button is edited in place so navigation never litters the
 * chat with new menu messages. Otherwise a fresh message is sent.
 */
export async function showScreen(ctx: Context, screen: BotScreen) {
  const message = ctx.callbackQuery?.message;
  const canEdit = Boolean(message && "text" in message && !("photo" in message));

  if (canEdit) {
    try {
      await ctx.editMessageText(screen.text, {
        parse_mode: "HTML",
        reply_markup: screen.keyboard,
      });
      return;
    } catch (error) {
      if (isNotModified(error)) return;
    }
  }

  try {
    await ctx.reply(screen.text, {
      parse_mode: "HTML",
      reply_markup: screen.keyboard,
    });
  } catch (error) {
    // If Telegram rejects the markup (e.g. a bad Web App URL), still show the
    // screen as plain text instead of failing silently.
    console.error("showScreen markup rejected:", error);
    await ctx.reply(screen.text, { parse_mode: "HTML" });
  }
}
