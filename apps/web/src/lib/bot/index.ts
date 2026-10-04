import { Bot, webhookCallback, type BotError, type Context } from "grammy";
import { api } from "convex/_generated/api";
import { matchKeyboardAction, t } from "./copy";
import { routeCallback } from "./callbacks";
import { ensureProfile, getConvex } from "./convex";
import { setRequestTranslationOverrides } from "./i18n-overrides";
import { mergedBotCopy } from "@/lib/i18n/botMerge";
import { mainInlineMenu } from "./keyboards";
import { maybeOnboard, sendMainMenu } from "./onboarding";
import { sendTrackedLinkStart } from "./tracked-link";
import { cancelQuiz, startQuiz } from "./quiz";
import type { TranslationOverride } from "@/lib/i18n/merge";
import {
  handleBotAddedToGroup,
  handleGroupMessage,
  isGroupChat,
} from "./groups";
import { getWebhookSecret } from "./webhook-secret";
import { allow } from "./rate-limit";
import {
  cancelProUpgrade,
  handleProCaption,
  handleProPhoto,
  handleSettingsTrackPage,
  sendDuel,
  sendDuelAccept,
  sendGiftAccept,
  sendHelp,
  sendHistory,
  sendHowItWorks,
  sendPro,
  sendRanks,
  sendSettings,
  sendStats,
  sendSupport,
} from "./screens";

export { sendProDecision, sendTelegramMessage } from "./notify";

function isBackendUnavailable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /deployments have been disabled|exceeded the free plan|NEXT_PUBLIC_CONVEX_URL is not configured/i.test(
    msg,
  );
}

function isAccountBanned(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("ACCOUNT_BANNED");
}

const BANNED_NOTICE_EN =
  "🚫 Your account has been suspended from Exam Bot.\n\nIf you think this is a mistake, contact support.";

const OVERRIDE_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedOverrides: TranslationOverride[] | null = null;
let overridesExpireAt = 0;
let overridesRequest: Promise<TranslationOverride[]> | null = null;

async function getCachedOverrides(): Promise<TranslationOverride[]> {
  const now = Date.now();
  if (cachedOverrides && now < overridesExpireAt) return cachedOverrides;
  if (!overridesRequest) {
    overridesRequest = getConvex()
      .query(api.translations.getOverrides, {})
      .then((overrides) => {
        cachedOverrides = overrides;
        overridesExpireAt = Date.now() + OVERRIDE_CACHE_TTL_MS;
        return overrides;
      })
      .finally(() => {
        overridesRequest = null;
      });
  }
  return await overridesRequest;
}

function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const bot = new Bot(token);

  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      console.error("Telegram bot handler error:", error);
      if (isAccountBanned(error)) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery().catch(() => undefined);
        }
        await ctx.reply(BANNED_NOTICE_EN).catch(() => undefined);
        return;
      }
      if (!isBackendUnavailable(error)) throw error;
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery().catch(() => undefined);
      }
      await ctx.reply(t("en").serviceUnavailable).catch(() => undefined);
    }
  });

  bot.use(async (_ctx, next) => {
    try {
      const overrides = await getCachedOverrides();
      setRequestTranslationOverrides(overrides);
    } catch {
      setRequestTranslationOverrides([]);
    }
    await next();
  });

  // Telegram retries an update if the webhook is slow. Ignore repeats that hit
  // the same warm instance so users never see a message sent twice.
  const seenUpdates = new Map<number, number>();
  const SEEN_UPDATE_TTL_MS = 60_000;
  bot.use(async (ctx, next) => {
    const id = ctx.update.update_id;
    const now = Date.now();
    const previous = seenUpdates.get(id);
    if (previous && now - previous < SEEN_UPDATE_TTL_MS) return;
    seenUpdates.set(id, now);
    if (seenUpdates.size > 1_000) {
      for (const [key, at] of seenUpdates) {
        if (now - at > SEEN_UPDATE_TTL_MS) seenUpdates.delete(key);
      }
    }
    await next();
  });

  void registerCommands(bot);

  bot.on("my_chat_member", handleBotAddedToGroup);

  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const key = `${ctx.chat?.id ?? "unknown"}:${ctx.from.id}`;
      if (!allow(key, { rate: 2, burst: 10 })) {
        // Clear the button spinner even when we drop the update.
        if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);
        return;
      }
    }
    await next();
  });

  bot.use(async (ctx, next) => {
    if (!isGroupChat(ctx)) {
      await next();
      return;
    }
    await handleGroupMessage(ctx);
  });

  bot.command("start", async (ctx) => {
    if (isGroupChat(ctx)) return;
    if (!ctx.from) return;
    const payload = typeof ctx.match === "string" ? ctx.match : "";
    await ensureProfile(ctx.from);
    if (payload.startsWith("duel_")) {
      await sendDuelAccept(ctx, payload.slice(5).toUpperCase());
      return;
    }
    if (payload.startsWith("gift_")) {
      await sendGiftAccept(ctx, payload.slice(5).toUpperCase());
      return;
    }
    if (payload.startsWith("link_")) {
      await sendTrackedLinkStart(ctx, payload.slice(5).toUpperCase());
      return;
    }
    await maybeOnboard(ctx, { welcome: true });
  });

  bot.command("menu", async (ctx) => {
    if (isGroupChat(ctx)) return;
    if (!ctx.from) return;
    const session = await ensureProfile(ctx.from);
    if (!session.profile.onboardingComplete) {
      await maybeOnboard(ctx);
      return;
    }
    await sendMainMenu(ctx, session.lang, session.profile.firstName);
  });

  bot.command("help", async (ctx) => {
    if (isGroupChat(ctx)) return;
    if (!ctx.from) return;
    const session = await ensureProfile(ctx.from);
    await sendHelp(ctx, session.lang);
  });

  bot.command("quiz", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await startQuiz(ctx, "quick");
  });
  bot.command("study", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await startQuiz(ctx, "quick");
  });
  bot.command("mock", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await startQuiz(ctx, "mock");
  });
  bot.command("exam", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await startQuiz(ctx, "mock");
  });
  bot.command("daily", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await startQuiz(ctx, "daily");
  });
  bot.command("mistakes", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await startQuiz(ctx, "mistakes");
  });
  bot.command("stats", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendStats(ctx);
  });
  bot.command("streak", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendStats(ctx);
  });
  bot.command("ranks", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendRanks(ctx);
  });
  bot.command("settings", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendSettings(ctx);
  });
  bot.command("how", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendHowItWorks(ctx);
  });
  bot.command("howitworks", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendHowItWorks(ctx);
  });
  bot.command("support", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendSupport(ctx);
  });
  bot.command("pro", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendPro(ctx);
  });
  bot.command("duel", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendDuel(ctx);
  });
  bot.command("history", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await sendHistory(ctx);
  });
  bot.command("cancel", async (ctx) => {
    if (isGroupChat(ctx)) return;
    if (await cancelProUpgrade(ctx)) return;
    await cancelQuiz(ctx);
  });

  bot.on("callback_query:data", async (ctx) => {
    if (isGroupChat(ctx)) {
      await handleGroupMessage(ctx);
      return;
    }
    await routeCallback(ctx);
  });

  bot.on("message:photo", async (ctx) => {
    if (isGroupChat(ctx)) return;
    await handleProPhoto(ctx);
  });

  bot.on("message:text", async (ctx) => {
    if (isGroupChat(ctx)) return;
    const text = ctx.message.text;
    if (text.startsWith("/")) return;

    if (await handleProCaption(ctx)) return;

    if (!ctx.from) return;
    const session = await ensureProfile(ctx.from);
    if (!session.profile.onboardingComplete) {
      await maybeOnboard(ctx, { welcome: true });
      return;
    }

    const action = matchKeyboardAction(text, [t("en"), t("am")]);
    if (!action) {
      await ctx.reply(t(session.lang).unknown, {
        reply_markup: mainInlineMenu(session.lang),
      });
      return;
    }

    if (action === "quiz") await startQuiz(ctx, "quick");
    else if (action === "mock") await startQuiz(ctx, "mock");
    else if (action === "daily") await startQuiz(ctx, "daily");
    else if (action === "mistakes") await startQuiz(ctx, "mistakes");
    else if (action === "stats") await sendStats(ctx);
    else if (action === "ranks") await sendRanks(ctx);
    else if (action === "tracks") await handleSettingsTrackPage(ctx);
    else if (action === "duel") await sendDuel(ctx);
    else if (action === "history") await sendHistory(ctx);
    else if (action === "settings") await sendSettings(ctx);
    else if (action === "pro") await sendPro(ctx);
    else if (action === "how") await sendHowItWorks(ctx);
    else if (action === "support") await sendSupport(ctx);
    else if (action === "more") {
      await sendMainMenu(ctx, session.lang, session.profile.firstName);
    }
  });

  bot.catch((err: BotError<Context>) => {
    console.error("Telegram bot error:", err.error);
    if (isAccountBanned(err.error)) {
      void err.ctx
        .reply(BANNED_NOTICE_EN)
        .catch(() => undefined);
    }
  });

  return bot;
}

function productionWebhookUrl(): string | null {
  const mini = process.env.NEXT_PUBLIC_MINI_APP_URL;
  if (!mini) return null;
  try {
    const url = new URL(mini);
    url.pathname = "/api/telegram/webhook";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function registerCommands(bot: Bot) {
  try {
    const webhookUrl = productionWebhookUrl();
    if (webhookUrl && process.env.TELEGRAM_BOT_TOKEN) {
      const secretToken = getWebhookSecret();
      await bot.api.setWebhook(webhookUrl, {
        allowed_updates: ["message", "callback_query", "my_chat_member"],
        drop_pending_updates: false,
        ...(secretToken ? { secret_token: secretToken } : {}),
      });
    }

    const overrides = await getCachedOverrides().catch(() => []);
    const en = overrides.length ? mergedBotCopy("en", overrides) : t("en");
    const am = overrides.length ? mergedBotCopy("am", overrides) : t("am");

    await bot.api.setMyCommands(
      [
        { command: "start", description: en.cmdGroupStart },
        { command: "duel", description: en.cmdGroupDuel },
        { command: "help", description: en.cmdGroupHelp },
      ],
      {
        scope: { type: "all_group_chats" },
      },
    );
    await bot.api.setMyCommands(
      [
        { command: "start", description: am.cmdGroupStart },
        { command: "duel", description: am.cmdGroupDuel },
        { command: "help", description: am.cmdGroupHelp },
      ],
      {
        scope: { type: "all_group_chats" },
        language_code: "am",
      },
    );

    await bot.api.setMyCommands([
      { command: "start", description: en.cmdStart },
      { command: "quiz", description: en.cmdQuiz },
      { command: "exam", description: en.cmdExam },
      { command: "daily", description: en.cmdDaily },
      { command: "mistakes", description: en.cmdMistakes },
      { command: "stats", description: en.cmdStats },
      { command: "ranks", description: en.cmdRanks },
      { command: "settings", description: en.cmdSettings },
      { command: "how", description: en.cmdHow },
      { command: "support", description: en.cmdSupport },
      { command: "pro", description: en.cmdPro },
      { command: "duel", description: en.cmdDuel },
      { command: "history", description: en.cmdHistory },
      { command: "cancel", description: en.cmdCancel },
      { command: "help", description: en.cmdHelp },
      { command: "menu", description: en.cmdMenu },
    ]);
    await bot.api.setMyCommands(
      [
        { command: "start", description: am.cmdStart },
        { command: "quiz", description: am.cmdQuiz },
        { command: "exam", description: am.cmdExam },
        { command: "daily", description: am.cmdDaily },
        { command: "mistakes", description: am.cmdMistakes },
        { command: "stats", description: am.cmdStats },
        { command: "ranks", description: am.cmdRanks },
        { command: "settings", description: am.cmdSettings },
        { command: "how", description: am.cmdHow },
        { command: "support", description: am.cmdSupport },
        { command: "pro", description: am.cmdPro },
        { command: "duel", description: am.cmdDuel },
        { command: "history", description: am.cmdHistory },
        { command: "cancel", description: am.cmdCancel },
        { command: "help", description: am.cmdHelp },
        { command: "menu", description: am.cmdMenu },
      ],
      { language_code: "am" },
    );
  } catch (error) {
    console.error("Failed to set bot commands:", error);
  }
}

let botInstance: Bot | null = null;

export function getBot() {
  if (!botInstance) {
    botInstance = createBot();
  }
  return botInstance;
}

export function getWebhookHandler() {
  return webhookCallback(getBot(), "std/http", {
    secretToken: getWebhookSecret() ?? undefined,
  });
}
