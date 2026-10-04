import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { fill, modeLabel, t, type Lang, type SessionMode } from "./copy";
import { ensureProfile, getConvex, type Ensured } from "./convex";
import { esc, truncate } from "./html";
import {
  appendMenuButton,
  confirmSessionKeyboard,
  feedbackKeyboard,
  mainInlineMenu,
  MODE_SHORT,
  questionKeyboard,
  quotaKeyboard,
  scoreKeyboard,
  subjectKeyboard,
  trackKeyboard,
  trackNavForContext,
  webAppRow,
} from "./keyboards";
import { appUrls, dayIndexUtc, utcMidnightMs } from "./urls";
import { showScreen } from "./render";

const TEXT_MAX = 3500;
const CAPTION_MAX = 900;

async function loadTracks(convex: ReturnType<typeof getConvex>) {
  const rows = await convex.query(api.exams.listPublishedTracks, {});
  return rows.map((row) => ({
    slug: row.slug,
    nameEn: row.nameEn,
    nameAm: row.nameAm,
  }));
}

/** Published subjects inside a track, as the pickers need them. */
async function loadSubjects(convex: ReturnType<typeof getConvex>, trackSlug: string) {
  const rows = await convex.query(api.exams.listPublishedSubjects, { trackSlug });
  return rows.map((row) => ({
    slug: row.slug,
    nameEn: row.nameEn,
    nameAm: row.nameAm,
    maxMarks: row.maxMarks,
  }));
}

export async function sendTrackPicker(
  ctx: Context,
  lang: Lang,
  context: string,
  page = 0,
) {
  const convex = getConvex();
  const tracks = await loadTracks(convex);
  const c = t(lang);
  const keyboard = trackKeyboard(tracks, lang, context, page, 6, trackNavForContext(context));
  const text = `${c.needTrack}\n\n${c.page.replace("{n}", String(page + 1))}`;
  await showScreen(ctx, { text, keyboard });
}

export async function sendSubjectPicker(
  ctx: Context,
  lang: Lang,
  context: string,
  page = 0,
  trackSlug?: string,
) {
  const convex = getConvex();
  const slug = trackSlug ?? null;
  const subjectList = slug ? await loadSubjects(convex, slug) : [];
  const c = t(lang);
  const keyboard = subjectKeyboard(subjectList, lang, context, page, 8, slug ?? undefined);
  const text = subjectList.length
    ? `${c.pickSubject}\n\n${c.page.replace("{n}", String(page + 1))}`
    : c.noQuestions;
  await showScreen(ctx, { text, keyboard });
}

async function present(
  ctx: Context,
  html: string,
  keyboard: InlineKeyboard,
  imageUrl?: string | null,
) {
  const msg = ctx.callbackQuery?.message;
  const isPhoto = Boolean(msg && "photo" in msg);

  if (imageUrl) {
    const caption = truncate(html, CAPTION_MAX);
    if (isPhoto) {
      try {
        await ctx.editMessageCaption({
          caption,
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    await ctx.replyWithPhoto(imageUrl, {
      caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    return;
  }

  if (msg && !isPhoto) {
    try {
      await ctx.editMessageText(html, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return;
    } catch {
      /* fall through */
    }
  }

  await ctx.reply(html, { parse_mode: "HTML", reply_markup: keyboard });
}

function formatQuestion(
  lang: Lang,
  payload: {
    currentIndex: number;
    total: number;
    question: {
      chapter: string;
      textEn: string;
      textAm: string;
      options: Array<{ key: string; textEn: string; textAm: string }>;
    };
  },
  max: number,
) {
  const c = t(lang);
  const stem = payload.question.textEn;
  const header = `<b>${fill(c.qProgress, { n: payload.currentIndex + 1, total: payload.total })}</b> · ${esc(payload.question.chapter)}`;
  const options = payload.question.options
    .map((option) => {
      const text = option.textEn;
      return `<b>${esc(option.key)}.</b> ${esc(text)}`;
    })
    .join("\n");
  const body = `${header}\n\n${esc(stem)}\n\n${options}`;
  return truncate(body, max);
}

export async function renderCurrentQuestion(
  ctx: Context,
  session: Ensured,
  token: string,
) {
  const payload = await session.convex.query(api.chat.getQuestionPayload, {
    telegramId: session.telegramId,
    token,
  });
  if (!payload) {
    await showScreen(ctx, {
      text: t(session.lang).expired,
      keyboard: mainInlineMenu(session.lang),
    });
    return;
  }
  const html = formatQuestion(session.lang, payload, payload.question.imageUrl ? CAPTION_MAX : TEXT_MAX);
  const keys = payload.question.options.map((option) => option.key);
  await present(
    ctx,
    html,
    questionKeyboard(token, keys, session.lang),
    payload.question.imageUrl,
  );
}

async function finishIfNeeded(ctx: Context, session: Ensured, token: string, done: boolean) {
  if (!done) {
    await renderCurrentQuestion(ctx, session, token);
    return;
  }
  await finishSession(ctx, session, token);
}

export async function finishSession(ctx: Context, session: Ensured, token: string) {
  const c = t(session.lang);
  const result = await session.convex.mutation(api.chat.completeSession, {
    telegramId: session.telegramId,
    token,
  });

  if (!result.ok) {
    if (result.reason === "already_done") return;
    await showScreen(ctx, { text: c.stale, keyboard: mainInlineMenu(session.lang) });
    return;
  }
  if (result.empty) {
    await showScreen(ctx, { text: c.emptyQuiz, keyboard: mainInlineMenu(session.lang) });
    return;
  }

  const quota = await session.convex.query(api.exams.getDailyQuota, {
    telegramId: session.telegramId,
    todayStartMs: utcMidnightMs(),
  });
  const quotaLine = result.isPro
    ? c.quotaPro
    : fill(c.quotaLeft, { n: quota.freeQuestionsLeft });

  const html =
    `<b>${fill(c.scoreTitle, { mode: modeLabel(session.lang, result.mode) })}</b>\n\n` +
    fill(c.scoreBody, {
      score: result.score,
      total: result.availableMarks || result.totalQuestions,
      xp: result.xpGain,
      streak: result.streakCount,
      quota: quotaLine,
    });

  const keyboard = scoreKeyboard(session.lang, {
    mode: result.mode,
    attemptId: result.attemptId,
  });

  await present(ctx, html, keyboard);
}

export async function startQuiz(
  ctx: Context,
  mode: SessionMode,
  opts?: {
    force?: boolean;
    examId?: Id<"exams">;
    source?: "mock" | "past" | "all";
    subjectSlug?: string;
  },
) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const short =
    mode === "mock" ? "m" : mode === "daily" ? "d" : mode === "mistakes" ? "k" : "q";

  // Order matters: a track is needed before subjects exist, and a subject is
  // needed before any paper can be chosen.
  if (!session.profile.trackSlug) {
    await sendTrackPicker(ctx, session.lang, short);
    return;
  }
  if (!opts?.subjectSlug) {
    await sendSubjectPicker(ctx, session.lang, short, 0, session.profile.trackSlug);
    return;
  }
  const subjectSlug = opts.subjectSlug;

  if ((mode === "quick" || mode === "mock" || mode === "daily") && !opts?.source && !opts?.examId) {
    await sendSourcePicker(ctx, session, mode, subjectSlug);
    return;
  }

  const source = opts?.source ?? (opts?.examId ? "past" : undefined);

  const started = await session.convex.mutation(api.chat.startSession, {
    telegramId: session.telegramId,
    mode,
    subjectSlug,
    examId: opts?.examId,
    source,
    force: opts?.force,
    dayIndex: dayIndexUtc(),
  });

  if (!started.ok) {
    if (started.reason === "active_session" && started.existingToken && started.existingMode) {
      await showScreen(ctx, {
        text: fill(c.activeSession, { mode: modeLabel(session.lang, started.existingMode) }),
        keyboard: confirmSessionKeyboard(
          session.lang,
          started.existingToken,
          mode,
          source,
          opts?.examId,
          subjectSlug,
        ),
      });
      return;
    }
    if (started.reason === "quota") {
      await showScreen(ctx, { text: c.quotaGone, keyboard: quotaKeyboard(session.lang) });
      return;
    }
    if (started.reason === "not_pro") {
      const extra = started.unmasteredCount
        ? ` (${started.unmasteredCount})`
        : "";
      await showScreen(ctx, {
        text: fill(c.notProMistakes, { count: extra }),
        keyboard: quotaKeyboard(session.lang),
      });
      return;
    }
    if (started.reason === "no_subject") {
      await sendSubjectPicker(ctx, session.lang, "q", 0, session.profile.trackSlug ?? undefined);
      return;
    }
    await showScreen(ctx, {
      text: mode === "mistakes" ? c.noMistakes : c.noQuestions,
      keyboard: mainInlineMenu(session.lang),
    });
    return;
  }

  if (started.capped && !started.isPro) {
    await showScreen(ctx, {
      text: fill(c.mockCapped, { n: started.total }),
      keyboard: webAppRow(
        t(session.lang).openTimedMock,
        appUrls.exam(
          subjectSlug,
          source ?? "past",
          started.examId,
        ),
      ),
    });
  }

  await renderCurrentQuestion(ctx, session, started.token);
}

export async function sendSourcePicker(
  ctx: Context,
  session: Ensured,
  mode: SessionMode,
  subjectSlug: string,
) {
  const c = t(session.lang);
  const short = mode === "mock" ? "m" : mode === "daily" ? "d" : "q";

  const sources = await session.convex.query(api.exams.listQuestionSources, {
    subjectSlug,
  });
  const keyboard = new InlineKeyboard();
  if (sources.mock.available) {
    keyboard.text(c.sourceMock, `src:${short}:mock:${subjectSlug}`).row();
  }
  if (sources.pastExams.length) {
    keyboard.text(c.sourcePast, `src:${short}:past:${subjectSlug}`).row();
  }
  if (sources.all.available) {
    keyboard.text(c.sourceAll, `src:${short}:all:${subjectSlug}`).row();
  }
  keyboard.webApp(
    c.openTimedMock,
    appUrls.exam(subjectSlug, sources.mock.available ? "mock" : undefined),
  );
  appendMenuButton(keyboard, session.lang);

  if (!sources.mock.available && !sources.pastExams.length && !sources.all.available) {
    await showScreen(ctx, { text: c.noQuestions, keyboard: mainInlineMenu(session.lang) });
    return;
  }
  const pickText =
    mode === "daily"
      ? fill(c.dailyPick, { n: session.profile.dailyGoal ?? 20 })
      : c.sourcePick;
  await showScreen(ctx, { text: pickText, keyboard });
}

export async function sendPastYearPicker(
  ctx: Context,
  session: Ensured,
  mode: SessionMode,
  subjectSlug: string,
) {
  const c = t(session.lang);
  const short = mode === "mock" ? "m" : mode === "daily" ? "d" : "q";

  const sources = await session.convex.query(api.exams.listQuestionSources, {
    subjectSlug,
  });
  if (!sources.pastExams.length) {
    await showScreen(ctx, { text: c.sourcePastEmpty, keyboard: mainInlineMenu(session.lang) });
    return;
  }
  if (sources.pastExams.length === 1 && sources.pastExams[0]) {
    await startQuiz(ctx, mode, {
      source: "past",
      examId: sources.pastExams[0]._id,
      subjectSlug,
    });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const exam of sources.pastExams.slice(0, 12)) {
    const label = session.lang === "am" ? exam.labelAm : exam.labelEn;
    keyboard.text(label.slice(0, 40), `e:${short}:${exam._id}:${subjectSlug}`).row();
  }
  keyboard.webApp(c.openTimedMock, appUrls.exam(subjectSlug, "past"));
  appendMenuButton(keyboard, session.lang);
  await showScreen(ctx, { text: c.pastPick, keyboard });
}

export async function handleAnswer(ctx: Context, token: string, key: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const result = await session.convex.mutation(api.chat.submitAnswer, {
    telegramId: session.telegramId,
    token,
    selectedKey: key,
  });
  if (!result.ok) {
    // A duplicate tap (or a stale button scrolled back to) must not clobber the
    // feedback that is already on screen.
    return;
  }

  const stem = result.textEn;
  const explanation = result.explanationEn;
  const verdict = result.isCorrect
    ? c.correct
    : fill(c.wrong, { key: result.correctKey });
  const html = truncate(
    `<b>${fill(c.qProgress, { n: result.currentIndex + 1, total: result.total })}</b>\n\n` +
      `${esc(stem)}\n\n${verdict}\n${esc(explanation)}`,
    TEXT_MAX,
  );
  await present(ctx, html, feedbackKeyboard(token, result.isLast, session.lang));
}

export async function handleNext(ctx: Context, token: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const advanced = await session.convex.mutation(api.chat.advanceSession, {
    telegramId: session.telegramId,
    token,
  });
  if (!advanced.ok) {
    return;
  }
  await finishIfNeeded(ctx, session, token, advanced.done);
}

export async function handleSkip(ctx: Context, token: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const skipped = await session.convex.mutation(api.chat.skipQuestion, {
    telegramId: session.telegramId,
    token,
  });
  if (!skipped.ok) {
    return;
  }
  await finishIfNeeded(ctx, session, token, skipped.done);
}

export async function handleEnd(ctx: Context, token: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  await finishSession(ctx, session, token);
}

export async function handleContinue(ctx: Context, token: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const payload = await session.convex.query(api.chat.getQuestionPayload, {
    telegramId: session.telegramId,
    token,
  });
  if (!payload) {
    await showScreen(ctx, {
      text: t(session.lang).expired,
      keyboard: mainInlineMenu(session.lang),
    });
    return;
  }
  if (payload.status === "awaiting_next") {
    await handleNext(ctx, token);
    return;
  }
  await renderCurrentQuestion(ctx, session, token);
}

export async function handleForceStart(
  ctx: Context,
  payload: string,
) {
  const [shortMode, source, examId, subjectSlug] = payload.split(":");
  const mode = shortMode ? MODE_SHORT[shortMode] : undefined;
  if (!mode) return;
  await startQuiz(ctx, mode, {
    force: true,
    source:
      source === "mock" || source === "past" || source === "all" ? source : undefined,
    examId: examId ? (examId as Id<"exams">) : undefined,
    subjectSlug,
  });
}

export async function cancelQuiz(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const active = await session.convex.query(api.chat.getActiveSession, {
    telegramId: session.telegramId,
    nowMs: Date.now(),
  });
  if (!active) {
    await showScreen(ctx, {
      text: t(session.lang).noActive,
      keyboard: mainInlineMenu(session.lang),
    });
    return;
  }
  await session.convex.mutation(api.chat.abandonSession, {
    telegramId: session.telegramId,
    token: active.token,
  });
  await showScreen(ctx, {
    text: t(session.lang).cancelled,
    keyboard: mainInlineMenu(session.lang),
  });
}

/** Map a picker context code back to the quiz mode it stands for. */
function modeForContext(context: string): SessionMode | undefined {
  if (context === "q") return "quick";
  if (context === "m") return "mock";
  if (context === "k") return "mistakes";
  if (context === "d") return "daily";
  return undefined;
}

/** Track chosen outside onboarding: store it, then narrow down to a subject. */
export async function startAfterTrackPick(ctx: Context, context: string, slug: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  await session.convex.mutation(api.users.updatePreferences, {
    telegramId: session.telegramId,
    trackSlug: slug,
  });
  await sendSubjectPicker(ctx, session.lang, context, 0, slug);
}

/** Subject chosen: now the real quiz can start for that paper's subject. */
export async function startAfterSubjectPick(
  ctx: Context,
  context: string,
  subjectSlug: string,
) {
  const mode = modeForContext(context);
  if (!mode) return;
  await startQuiz(ctx, mode, { subjectSlug });
}
