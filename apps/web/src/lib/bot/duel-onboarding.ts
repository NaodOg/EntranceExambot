import type { Context } from "grammy";
import { api } from "convex/_generated/api";
import { ensureProfile } from "./convex";

/** Infer UI language from Telegram user settings. */
export function telegramLanguage(ctx: Context): "en" | "am" {
  const code = ctx.from?.language_code?.toLowerCase() ?? "";
  return code.startsWith("am") ? "am" : "en";
}

export async function joinDuelFromInvite(ctx: Context, code: string) {
  if (!ctx.from) throw new Error("No user");
  const session = await ensureProfile(ctx.from);
  return await session.convex.mutation(api.duels.joinDuel, {
    telegramId: session.telegramId,
    code: code.toUpperCase(),
    language: telegramLanguage(ctx),
  });
}
