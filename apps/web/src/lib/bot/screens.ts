import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { fill, matchKeyboardAction, t, type Lang } from "./copy";
import { ensureProfile, type Ensured } from "./convex";
import { esc, formatDate } from "./html";
import {
  appendMenuButton,
  trackKeyboard,
  duelLobbyKeyboard,
  mainInlineMenu,
  webAppRow,
} from "./keyboards";
import { showScreen } from "./render";
import { isGroupChat } from "./groups";
import { sendGroupDuelMenu } from "./group-duel";
import { joinDuelFromInvite } from "./duel-onboarding";
import { SUPPORT_TELEGRAM_URL } from "@/lib/copy";
import { appUrls, utcMidnightMs } from "./urls";

function trackLockedKeyboard(lang: Lang) {
  const c = t(lang);
  const keyboard = new InlineKeyboard()
    .text(c.changeTrackPro, "m:pro")
    .webApp(c.openPro, appUrls.pro());
  appendMenuButton(keyboard, lang);
  return keyboard;
}

export async function sendHelp(ctx: Context, lang: Lang) {
  const keyboard = new InlineKeyboard();
  appendMenuButton(keyboard, lang);
  await showScreen(ctx, { text: t(lang).help, keyboard });
}

export async function sendMore(ctx: Context, session: Ensured) {
  await showScreen(ctx, {
    text: t(session.lang).menuTitle,
    keyboard: mainInlineMenu(session.lang),
  });
}

export async function sendStats(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const quota = await session.convex.query(api.exams.getDailyQuota, {
    telegramId: session.telegramId,
    todayStartMs: utcMidnightMs(),
  });
  const attempts = await session.convex.query(api.exams.listMyAttempts, {
    telegramId: session.telegramId,
    limit: 1,
  });
  const last = attempts.items[0];
  const lastLine = last
    ? fill(c.lastScore, {
        score: last.score,
        total: last.availableMarks || last.totalQuestions,
        percent: last.percent,
      })
    : c.noLast;
  const quotaLine = quota.isPro
    ? c.quotaPro
    : fill(c.quotaLeft, { n: quota.freeQuestionsLeft });

  const tracks = await session.convex.query(api.exams.listPublishedTracks, {});
  const track = tracks.find((row) => row.slug === session.profile.trackSlug);
  const trackName =
    session.lang === "am"
      ? track?.nameAm ?? session.profile.trackSlug ?? "—"
      : track?.nameEn ?? session.profile.trackSlug ?? "—";

  const html = fill(c.statsBody, {
    name: esc(
      session.profile.firstName ?? session.profile.username ?? c.studentFallback,
    ),
    track: esc(trackName),
    xp: session.profile.xp,
    streak: session.profile.streakCount,
    quota: quotaLine,
    last: lastLine,
  });

  const keyboard = new InlineKeyboard()
    .text(c.quiz, "m:quiz")
    .webApp(c.openApp, appUrls.home())
    .row()
    .webApp(c.openHistory, appUrls.history());
  appendMenuButton(keyboard, session.lang);

  await showScreen(ctx, { text: html, keyboard });
}

export async function sendRanks(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const slug = session.profile.trackSlug;
  if (!slug) {
    await showScreen(ctx, { text: c.noTrackStats, keyboard: mainInlineMenu(session.lang) });
    return;
  }

  const board = await session.convex.query(api.users.getTrackLeaderboard, {
    trackSlug: slug,
    telegramId: session.telegramId,
    period: "all_time",
    nowMs: Date.now(),
  });
  const tracks = await session.convex.query(api.exams.listPublishedTracks, {});
  const track = tracks.find((row) => row.slug === slug);
  const trackName = session.lang === "am" ? track?.nameAm ?? slug : track?.nameEn ?? slug;

  const top = board.top50.slice(0, 10);
  if (!top.length) {
    const keyboard = webAppRow(c.openRanks, appUrls.ranks());
    appendMenuButton(keyboard, session.lang);
    await showScreen(ctx, { text: c.ranksEmpty, keyboard });
    return;
  }

  const lines = top.map((row) => {
    const marker = row.isCurrentUser ? " ←" : "";
    return `${row.rank}. ${esc(row.name)} — ${row.xp} ${c.xpUnit}${marker}`;
  });
  const rankLine =
    board.userRank != null
      ? fill(c.yourRank, { rank: board.userRank, total: board.totalPlayers })
      : "";

  const keyboard = webAppRow(c.openRanks, appUrls.ranks());
  appendMenuButton(keyboard, session.lang);
  await showScreen(ctx, {
    text: `${fill(c.ranksTitle, { track: esc(trackName) })}\n\n${lines.join("\n")}\n\n${rankLine}`,
    keyboard,
  });
}

export async function sendSettings(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const tracks = await session.convex.query(api.exams.listPublishedTracks, {});
  const track = tracks.find((row) => row.slug === session.profile.trackSlug);
  const trackName =
    session.lang === "am"
      ? track?.nameAm ?? session.profile.trackSlug ?? "—"
      : track?.nameEn ?? session.profile.trackSlug ?? "—";

  const goal = session.profile.dailyGoal ?? 20;
  const keyboard = new InlineKeyboard()
    .text(c.langEn, "sk:en")
    .text(c.langAm, "sk:am")
    .row()
    .text(c.changeGoal, "sg")
    .text(c.stats, "m:stats")
    .row()
    .text(c.howItWorksBtn, "sk:how")
    .text(c.supportBtn, "sk:sup")
    .row()
    .webApp(c.openTheme, appUrls.account());
  appendMenuButton(keyboard, session.lang);

  const html = `<b>${c.settingsTitle}</b>\n\n${fill(c.settingsBody, {
    lang: session.lang === "am" ? c.langNameAm : c.langNameEn,
    track: esc(trackName),
    goal,
  })}`;

  await showScreen(ctx, { text: html, keyboard });
}

export async function sendHowItWorks(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const keyboard = new InlineKeyboard();
  appendMenuButton(keyboard, session.lang);
  await showScreen(ctx, {
    text: `<b>${c.howItWorksTitle}</b>\n\n${c.howItWorksBody}`,
    keyboard,
  });
}

export async function sendSupport(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const keyboard = new InlineKeyboard().url(c.openSupport, SUPPORT_TELEGRAM_URL);
  appendMenuButton(keyboard, session.lang);
  await showScreen(ctx, {
    text: `<b>${c.supportTitle}</b>\n\n${c.supportBody}`,
    keyboard,
  });
}

export async function handleSettingsLanguage(ctx: Context, language: Lang) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  await session.convex.mutation(api.users.updatePreferences, {
    telegramId: session.telegramId,
    language,
  });
  await sendSettings(ctx);
}

export async function handleSettingsTrackPage(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  if (!session.profile.isProActive) {
    await showScreen(ctx, { text: c.trackLocked, keyboard: trackLockedKeyboard(session.lang) });
    return;
  }
  const tracks = await session.convex.query(api.exams.listPublishedTracks, {});
  await showScreen(ctx, {
    text: c.changeTrack,
    keyboard: trackKeyboard(
      tracks.map((row) => ({ slug: row.slug, nameEn: row.nameEn, nameAm: row.nameAm })),
      session.lang,
      "s",
      0,
      6,
      "settings",
    ),
  });
}

const FREE_GOAL_CHOICES = [5, 10, 15, 20] as const;
const PRO_GOAL_CHOICES = [5, 10, 20, 30, 40, 50, 60, 80] as const;

export async function handleSettingsGoalPage(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const current = session.profile.dailyGoal ?? 20;
  const choices = session.profile.isProActive ? PRO_GOAL_CHOICES : FREE_GOAL_CHOICES;
  const keyboard = new InlineKeyboard();
  choices.forEach((n, index) => {
    const label = n === current ? `✓ ${n} ${c.questionUnit}` : `${n} ${c.questionUnit}`;
    keyboard.text(label, `sg:${n}`);
    if ((index + 1) % 4 === 0 && index + 1 < choices.length) {
      keyboard.row();
    }
  });
  appendMenuButton(keyboard, session.lang);
  await showScreen(ctx, { text: c.goalPick, keyboard });
}

export async function handleSettingsGoal(ctx: Context, raw: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    await handleSettingsGoalPage(ctx);
    return;
  }
  const max = session.profile.isProActive ? 80 : 20;
  const goal = Math.min(max, Math.max(5, parsed));
  await session.convex.mutation(api.users.updatePreferences, {
    telegramId: session.telegramId,
    dailyGoal: goal,
  });
  await sendSettings(ctx);
}

export async function handleSettingsTrack(ctx: Context, slug: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  if (!session.profile.isProActive) {
    await showScreen(ctx, { text: c.trackLocked, keyboard: trackLockedKeyboard(session.lang) });
    return;
  }
  try {
    await session.convex.mutation(api.users.updatePreferences, {
      telegramId: session.telegramId,
      trackSlug: slug,
    });
  } catch {
    await showScreen(ctx, { text: c.trackLocked, keyboard: trackLockedKeyboard(session.lang) });
    return;
  }
  await sendSettings(ctx);
}

export async function sendDuel(ctx: Context) {
  if (!ctx.from) return;
  if (isGroupChat(ctx)) {
    await sendGroupDuelMenu(ctx);
    return;
  }
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const keyboard = duelLobbyKeyboard(session.lang, false);
  appendMenuButton(keyboard, session.lang);
  await showScreen(ctx, { text: c.duelPitch, keyboard });
}

export async function sendDuelAccept(ctx: Context, code: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const upper = code.toUpperCase();
  try {
    await joinDuelFromInvite(ctx, upper);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (!raw.includes("already") && !raw.includes("closed") && !raw.includes("full")) {
      await ctx.reply(c.duelJoinFailed);
      return;
    }
  }
  await ctx.reply(fill(c.duelAccept, { code: esc(upper) }), {
    parse_mode: "HTML",
    reply_markup: webAppRow(c.duelPlayInApp, appUrls.duelMatch(upper)),
  });
}

export async function sendGiftAccept(ctx: Context, code: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  await ctx.reply(fill(c.giftAccept, { code: esc(code) }), {
    parse_mode: "HTML",
    reply_markup: webAppRow(c.giftRedeem, appUrls.proGift(code)),
  });
}

export async function sendHistory(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const keyboard = webAppRow(c.openHistory, appUrls.history());
  appendMenuButton(keyboard, session.lang);
  await showScreen(ctx, { text: c.historyPitch, keyboard });
}

export async function sendPro(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const settings = await session.convex.query(api.settings.get, {});
  const request = await session.convex.query(api.premium.getMyRequest, {
    telegramId: session.telegramId,
  });
  const price = settings?.proPriceEtb ?? 200;
  const date = formatDate(settings?.examSeasonEndAt ?? Date.now(), session.lang);
  const pay =
    session.lang === "am"
      ? settings?.paymentInstructionsAm ?? ""
      : settings?.paymentInstructionsEn ?? "";

  if (session.profile.isProActive) {
    const keyboard = webAppRow(c.openApp, appUrls.home());
    appendMenuButton(keyboard, session.lang);
    await showScreen(ctx, { text: fill(c.proActive, { date }), keyboard });
    return;
  }

  let statusLine = "";
  if (request?.status === "pending") statusLine = `\n\n${c.proPending}`;
  if (request?.status === "rejected") {
    const reason = request.rejectionReason ? `: ${esc(request.rejectionReason)}` : "";
    statusLine = `\n\n${fill(c.proRejected, { reason })}`;
  }

  const keyboard = new InlineKeyboard()
    .text(c.ivePaid, "pr:paid")
    .text(c.proCancel, "pr:cancel")
    .row()
    .webApp(c.openPro, appUrls.pro());
  appendMenuButton(keyboard, session.lang);

  await showScreen(ctx, {
    text: `<b>${c.proTitle}</b>\n\n${fill(c.proBody, { price, date, pay: esc(pay) })}${statusLine}`,
    keyboard,
  });
}

export async function handlePaidClick(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const request = await session.convex.query(api.premium.getMyRequest, {
    telegramId: session.telegramId,
  });
  if (request?.status === "pending") {
    await ctx.reply(t(session.lang).proPending, {
      reply_markup: mainInlineMenu(session.lang),
    });
    return;
  }
  await session.convex.mutation(api.chat.setIntent, {
    telegramId: session.telegramId,
    kind: "pro_photo",
  });
  const paidCopy = t(session.lang);
  const keyboard = new InlineKeyboard()
    .text(paidCopy.proCancel, "pr:cancel")
    .webApp(paidCopy.openPro, appUrls.pro());
  appendMenuButton(keyboard, session.lang);
  await showScreen(ctx, { text: paidCopy.sendPhoto, keyboard });
}

export async function cancelProUpgrade(
  ctx: Context,
  opts: { evenIfIdle?: boolean } = {},
): Promise<boolean> {
  if (!ctx.from) return false;
  const session = await ensureProfile(ctx.from);
  const intent = await session.convex.query(api.chat.getIntent, {
    telegramId: session.telegramId,
  });
  if (!intent && !opts.evenIfIdle) return false;
  if (intent) {
    await session.convex.mutation(api.chat.clearIntent, {
      telegramId: session.telegramId,
    });
  }
  await showScreen(ctx, {
    text: t(session.lang).proCancelled,
    keyboard: mainInlineMenu(session.lang),
  });
  return true;
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export async function handleProPhoto(ctx: Context): Promise<boolean> {
  if (!ctx.from || !ctx.message || !("photo" in ctx.message) || !ctx.message.photo) {
    return false;
  }
  const session = await ensureProfile(ctx.from);
  const intent = await session.convex.query(api.chat.getIntent, {
    telegramId: session.telegramId,
  });

  const inProFlow = intent?.kind === "pro_photo";
  if (!inProFlow) {
    // Photo sent outside the guided flow: accept it as a payment proof too.
    if (session.profile.isProActive) {
      const settings = await session.convex.query(api.settings.get, {});
      await ctx.reply(
        fill(t(session.lang).proActive, {
          date: formatDate(settings?.examSeasonEndAt ?? Date.now(), session.lang),
        }),
        { reply_markup: mainInlineMenu(session.lang) },
      );
      return true;
    }
    const request = await session.convex.query(api.premium.getMyRequest, {
      telegramId: session.telegramId,
    });
    if (request?.status === "pending") {
      await ctx.reply(t(session.lang).proPending, {
        reply_markup: mainInlineMenu(session.lang),
      });
      return true;
    }
  }

  const c = t(session.lang);
  const photos = ctx.message.photo;
  const best = photos[photos.length - 1];
  if (!best) {
    await ctx.reply(c.sendPhotoNeed);
    return true;
  }
  if ((best.file_size ?? 0) > MAX_PROOF_BYTES) {
    await ctx.reply(c.proTooBig, {
      reply_markup: new InlineKeyboard()
        .text(c.proCancel, "pr:cancel")
        .webApp(c.openPro, appUrls.pro()),
    });
    return true;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    await ctx.reply(c.stale);
    return true;
  }

  const file = await ctx.api.getFile(best.file_id);
  if (!file.file_path) {
    await ctx.reply(c.sendPhotoNeed);
    return true;
  }

  const download = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!download.ok) {
    await ctx.reply(c.sendPhotoNeed);
    return true;
  }
  const bytes = await download.arrayBuffer();
  if (bytes.byteLength > MAX_PROOF_BYTES) {
    await ctx.reply(c.proTooBig, {
      reply_markup: new InlineKeyboard()
        .text(c.proCancel, "pr:cancel")
        .webApp(c.openPro, appUrls.pro()),
    });
    return true;
  }

  const uploadUrl = await session.convex.mutation(api.premium.generateUploadUrl, {});
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": download.headers.get("content-type") ?? "image/jpeg" },
    body: bytes,
  });
  if (!uploaded.ok) {
    await ctx.reply(c.proUploadFailed, {
      reply_markup: new InlineKeyboard()
        .text(c.proCancel, "pr:cancel")
        .webApp(c.openPro, appUrls.pro()),
    });
    return true;
  }
  const uploadedJson = (await uploaded.json()) as { storageId?: string };
  if (!uploadedJson.storageId) {
    await ctx.reply(c.stale);
    return true;
  }

  try {
    await session.convex.mutation(api.premium.submitRequest, {
      telegramId: session.telegramId,
      proofFileId: uploadedJson.storageId as Id<"_storage">,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : c.stale;
    await ctx.reply(message);
    return true;
  }

  if (intent) {
    await session.convex.mutation(api.chat.clearIntent, { telegramId: session.telegramId });
  }
  await ctx.reply(c.proSubmitted, {
    reply_markup: mainInlineMenu(session.lang),
  });
  return true;
}

export async function handleProCaption(ctx: Context): Promise<boolean> {
  if (!ctx.from || !ctx.message || !("text" in ctx.message) || !ctx.message.text) {
    return false;
  }
  const session = await ensureProfile(ctx.from);
  const intent = await session.convex.query(api.chat.getIntent, {
    telegramId: session.telegramId,
  });
  if (!intent || intent.kind !== "pro_photo") return false;
  if (ctx.message.text.startsWith("/")) return false;
  if (matchKeyboardAction(ctx.message.text, [t("en"), t("am")])) {
    await session.convex.mutation(api.chat.clearIntent, {
      telegramId: session.telegramId,
    });
    return false;
  }
  const cancelLabels: string[] = [t("en").proCancel, t("am").proCancel];
  if (cancelLabels.includes(ctx.message.text.trim())) {
    await cancelProUpgrade(ctx);
    return true;
  }

  await ctx.reply(t(session.lang).sendPhoto);
  return true;
}
