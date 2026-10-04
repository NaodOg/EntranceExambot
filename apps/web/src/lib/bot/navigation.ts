import type { Context } from "grammy";
import { languageKeyboard } from "./keyboards";
import { t } from "./copy";
import { ensureProfile } from "./convex";
import { sendMainMenu, startOnboarding } from "./onboarding";
import { showScreen } from "./render";
import {
  handleSettingsTrackPage,
  handleSettingsGoalPage,
  sendDuel,
  sendHelp,
  sendHistory,
  sendHowItWorks,
  sendPro,
  sendRanks,
  sendSettings,
  sendStats,
  sendSupport,
} from "./screens";

export async function showLanguagePicker(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  await showScreen(ctx, {
    text: t(session.lang).onboardLang,
    keyboard: languageKeyboard(session.lang),
  });
}

/** Renders a `nav:*` screen by editing the message the button lives on. */
export async function routeBotNavigation(ctx: Context, data: string): Promise<boolean> {
  if (!data.startsWith("nav:")) return false;
  if (!ctx.from) return true;
  const action = data.slice("nav:".length);

  switch (action) {
    case "menu": {
      const session = await ensureProfile(ctx.from);
      if (!session.profile.onboardingComplete) {
        await startOnboarding(ctx, session.lang);
        return true;
      }
      await sendMainMenu(ctx, session.lang, session.profile.firstName);
      return true;
    }
    case "settings":
      await sendSettings(ctx);
      return true;
    case "lang":
      await showLanguagePicker(ctx);
      return true;
    case "stats":
      await sendStats(ctx);
      return true;
    case "ranks":
      await sendRanks(ctx);
      return true;
    case "how":
      await sendHowItWorks(ctx);
      return true;
    case "support":
      await sendSupport(ctx);
      return true;
    case "pro":
      await sendPro(ctx);
      return true;
    case "history":
      await sendHistory(ctx);
      return true;
    case "duel":
      await sendDuel(ctx);
      return true;
    case "help": {
      const session = await ensureProfile(ctx.from);
      await sendHelp(ctx, session.lang);
      return true;
    }
    case "goal":
      await handleSettingsGoalPage(ctx);
      return true;
    case "track":
      await handleSettingsTrackPage(ctx);
      return true;
    default:
      return true;
  }
}
