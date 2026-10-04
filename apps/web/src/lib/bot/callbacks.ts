import type { Context } from "grammy";
import { ensureProfile } from "./convex";
import {
  handleOnboardLanguage,
  handleOnboardSubject,
  handleOnboardTrack,
  handleSubjectPage,
  handleTrackPage,
  sendMainMenu,
} from "./onboarding";
import {
  handleAnswer,
  handleContinue,
  handleEnd,
  handleForceStart,
  handleNext,
  handleSkip,
  sendPastYearPicker,
  startAfterSubjectPick,
  startAfterTrackPick,
  startQuiz,
} from "./quiz";
import { routeBotNavigation } from "./navigation";
import {
  cancelProUpgrade,
  handlePaidClick,
  handleSettingsGoal,
  handleSettingsGoalPage,
  handleSettingsLanguage,
  handleSettingsTrack,
  handleSettingsTrackPage,
  sendDuel,
  sendHelp,
  sendHistory,
  sendMore,
  sendPro,
  sendRanks,
  sendHowItWorks,
  sendSettings,
  sendStats,
  sendSupport,
} from "./screens";
import type { Id } from "convex/_generated/dataModel";
import type { Lang } from "./copy";
import { handleGroupMessage, isGroupChat } from "./groups";

export async function routeCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data || !ctx.from) return;
  if (isGroupChat(ctx)) {
    await handleGroupMessage(ctx);
    return;
  }
  await ctx.answerCallbackQuery().catch(() => undefined);

  if (data.startsWith("nav:")) {
    await routeBotNavigation(ctx, data);
    return;
  }

  if (data === "k:en" || data === "k:am") {
    await handleOnboardLanguage(ctx, data.slice(2) as Lang);
    return;
  }
  if (data.startsWith("p:")) {
    const [, context, page] = data.split(":");
    if (context && page != null) {
      await handleTrackPage(ctx, context, Number(page) || 0);
    }
    return;
  }
  if (data.startsWith("sp:")) {
    // sp:<context>:<trackSlug>:<page>
    const parts = data.split(":");
    const context = parts[1] ?? "";
    const trackSlug = parts[2] && parts[2] !== "-" ? parts[2] : undefined;
    const page = Number(parts[3]) || 0;
    await handleSubjectPage(ctx, context, trackSlug, page);
    return;
  }
  if (data.startsWith("sub:")) {
    const parts = data.split(":");
    const context = parts[1] ?? "";
    const subjectSlug = parts.slice(2).join(":");
    if (context === "o") {
      await handleOnboardSubject(ctx, subjectSlug);
      return;
    }
    await startAfterSubjectPick(ctx, context, subjectSlug);
    return;
  }
  if (data.startsWith("t:")) {
    const parts = data.split(":");
    const context = parts[1] ?? "";
    const slug = parts.slice(2).join(":");
    if (context === "o") {
      await handleOnboardTrack(ctx, slug);
      return;
    }
    if (context === "s") {
      await handleSettingsTrack(ctx, slug);
      return;
    }
    await startAfterTrackPick(ctx, context, slug);
    return;
  }
  if (data.startsWith("a:")) {
    const [, token, key] = data.split(":");
    if (token && key) await handleAnswer(ctx, token, key);
    return;
  }
  if (data.startsWith("n:") && data.length > 2) {
    await handleNext(ctx, data.slice(2));
    return;
  }
  if (data.startsWith("s:") && data.length > 2) {
    await handleSkip(ctx, data.slice(2));
    return;
  }
  if (data.startsWith("x:") && data.length > 2) {
    await handleEnd(ctx, data.slice(2));
    return;
  }
  if (data.startsWith("c:") && data.length > 2) {
    await handleContinue(ctx, data.slice(2));
    return;
  }
  if (data.startsWith("f:") && data.length > 2) {
    await handleForceStart(ctx, data.slice(2));
    return;
  }
  if (data.startsWith("src:")) {
    // src:<short>:<source>:<subjectSlug>
    const [, short, source, subjectSlug] = data.split(":");
    const mode = short === "m" ? "mock" : short === "d" ? "daily" : "quick";
    if (source === "past") {
      if (!ctx.from || !subjectSlug) return;
      const session = await ensureProfile(ctx.from);
      await sendPastYearPicker(ctx, session, mode, subjectSlug);
      return;
    }
    if (source === "mock") {
      await startQuiz(ctx, mode, { source: "mock", subjectSlug });
      return;
    }
    if (source === "all") {
      await startQuiz(ctx, mode, { source: "all", subjectSlug });
    }
    return;
  }
  if (data.startsWith("e:")) {
    // e:<short>:<examId>:<subjectSlug>
    const parts = data.slice(2).split(":");
    const subjectSlug = parts.length >= 3 ? parts.slice(2).join(":") : undefined;
    const mode = parts[0] === "m" ? "mock" : parts[0] === "d" ? "daily" : "quick";
    if (parts[0] === "q" || parts[0] === "m" || parts[0] === "d") {
      await startQuiz(ctx, mode, {
        source: "past",
        examId: parts.slice(1, parts.length - (subjectSlug ? 1 : 0)).join(":") as Id<"exams">,
        subjectSlug,
      });
      return;
    }
    await startQuiz(ctx, "mock", {
      source: "past",
      examId: data.slice(2) as Id<"exams">,
      subjectSlug,
    });
    return;
  }
  if (data === "sk:en" || data === "sk:am") {
    await handleSettingsLanguage(ctx, data.slice(3) as Lang);
    return;
  }
  if (data === "sk:how") {
    await sendHowItWorks(ctx);
    return;
  }
  if (data === "sk:sup") {
    await sendSupport(ctx);
    return;
  }
  if (data === "sd") {
    await handleSettingsTrackPage(ctx);
    return;
  }
  if (data === "sg") {
    await handleSettingsGoalPage(ctx);
    return;
  }
  if (data.startsWith("sg:")) {
    await handleSettingsGoal(ctx, data.slice(3));
    return;
  }
  if (data === "pr:paid") {
    await handlePaidClick(ctx);
    return;
  }
  if (data === "pr:cancel") {
    await cancelProUpgrade(ctx, { evenIfIdle: true });
    return;
  }
  if (data.startsWith("m:")) {
    await routeMenu(ctx, data.slice(2));
  }
}

async function routeMenu(ctx: Context, action: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  switch (action) {
    case "quiz":
      await startQuiz(ctx, "quick");
      break;
    case "mock":
      await startQuiz(ctx, "mock");
      break;
    case "daily":
      await startQuiz(ctx, "daily");
      break;
    case "mistakes":
      await startQuiz(ctx, "mistakes");
      break;
    case "stats":
      await sendStats(ctx);
      break;
    case "ranks":
      await sendRanks(ctx);
      break;
    case "track":
      await handleSettingsTrackPage(ctx);
      break;
    case "set":
      await sendSettings(ctx);
      break;
    case "pro":
      await sendPro(ctx);
      break;
    case "duel":
      await sendDuel(ctx);
      break;
    case "hist":
      await sendHistory(ctx);
      break;
    case "menu":
      await sendMainMenu(ctx, session.lang, session.profile.firstName);
      break;
    case "more":
      await sendMore(ctx, session);
      break;
    case "help":
      await sendHelp(ctx, session.lang);
      break;
    default:
      break;
  }
}
