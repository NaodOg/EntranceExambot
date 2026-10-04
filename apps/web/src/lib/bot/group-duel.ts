import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { FunctionReturnType } from "convex/server";
import { api } from "convex/_generated/api";
import { buildMiniAppLink } from "@/lib/bot-links";
import { fill, t, type Lang } from "./copy";
import { ensureProfile, type Ensured } from "./convex";
import { appendPickerNav } from "./keyboards";
import { esc, truncate } from "./html";

const QUESTION_COUNTS = [5, 10, 15, 20] as const;
const PLAYER_COUNTS = [2, 4, 6, 8, 10] as const;
const PAGE_SIZE = 6;

type Subject = { slug: string; nameEn: string; nameAm: string };
type DuelView = NonNullable<FunctionReturnType<typeof api.groupDuels.getGroupDuel>>;
type RoundView = FunctionReturnType<typeof api.groupDuels.startGroupDuel>;

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function emptyKeyboard(): InlineKeyboard {
  return new InlineKeyboard();
}

/** Telegram throws this when an edit would leave the message unchanged. */
function isNotModified(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /message is not modified/i.test(msg);
}

/** Try to edit the existing message; only send a new one for real failures. */
async function editOrReply(
  ctx: Context,
  text: string,
  markup: InlineKeyboard | undefined,
  edit: boolean,
) {
  const opts = { parse_mode: "HTML" as const, reply_markup: markup };
  if (edit) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch (err) {
      if (isNotModified(err)) return;
    }
  }
  await ctx.reply(text, opts);
}

function subjectLabel(subjects: Subject[], slug: string | null, lang: Lang): string {
  if (!slug) return "";
  const found = subjects.find((subject) => subject.slug === slug);
  if (!found) return slug;
  return lang === "am" ? found.nameAm : found.nameEn;
}

/** Subjects are scoped to the user's chosen track. */
async function loadSubjects(session: Ensured): Promise<Subject[]> {
  const trackSlug = session.profile.trackSlug;
  if (!trackSlug) return [];
  const rows = await session.convex.query(api.exams.listPublishedSubjects, { trackSlug });
  return rows.map((row) => ({ slug: row.slug, nameEn: row.nameEn, nameAm: row.nameAm }));
}

function privateChatUrl(ctx: Context, startParam?: string): string | null {
  const username = ctx.me?.username;
  if (!username) return null;
  const base = `https://t.me/${username}`;
  return startParam ? `${base}?start=${encodeURIComponent(startParam)}` : base;
}

function errorMessage(err: unknown, lang: Lang): string {
  const c = t(lang);
  const msg = err instanceof Error ? err.message : "";
  if (/daily free limit|free limit|20 questions/i.test(msg)) return c.quotaGone;
  if (/full/i.test(msg)) return c.groupDuelFull;
  if (/already started|already closed/i.test(msg)) return c.groupDuelAlreadyStarted;
  if (/only the host/i.test(msg)) return c.groupDuelHostStartOnly;
  if (/need at least/i.test(msg)) return c.groupDuelNeedPlayers;
  if (/not enough/i.test(msg)) return c.groupDuelNotEnough;
  if (/published/i.test(msg)) return c.groupDuelNoQuestions;
  return c.groupDuelCreateFailed;
}

export async function sendGroupStart(ctx: Context) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const keyboard = new InlineKeyboard().text(c.groupStartDuel, "gg:menu");
  const dm = privateChatUrl(ctx, ctx.chat?.id ? `group_${ctx.chat.id}` : undefined);
  if (dm) keyboard.row().url(c.groupOpenPrivate, dm);
  await ctx.reply(c.groupStart, {
    parse_mode: "HTML",
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  });
}

export async function sendGroupDuelMenu(ctx: Context, edit = false) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const c = t(session.lang);
  const keyboard = new InlineKeyboard()
    .url(c.groupDuelInApp, buildMiniAppLink("duel_lobby"))
    .text(c.groupDuelInChat, "gg:chat");
  const opts = { parse_mode: "HTML" as const, reply_markup: keyboard };
  if (edit) {
    try {
      await ctx.editMessageText(c.groupDuelMenu, opts);
      return;
    } catch (err) {
      if (isNotModified(err)) return;
    }
  }
  await ctx.reply(c.groupDuelMenu, opts);
}

function subjectSetupKeyboard(
  lang: Lang,
  subjects: Subject[],
  token: string,
  page: number,
) {
  const c = t(lang);
  const keyboard = new InlineKeyboard();
  const start = page * PAGE_SIZE;
  subjects.slice(start, start + PAGE_SIZE).forEach((subject, index) => {
    const label = lang === "am" ? subject.nameAm : subject.nameEn;
    keyboard.text(label.slice(0, 40), `gs:${token}:d:${start + index}`).row();
  });
  if (page > 0) keyboard.text(c.prev, `gs:${token}:dp:${page - 1}`);
  if (start + PAGE_SIZE < subjects.length) {
    keyboard.text(c.nextPage, `gs:${token}:dp:${page + 1}`);
  }
  keyboard.row().text(c.groupDuelCancel, `gs:${token}:cancel`);
  return keyboard;
}

function countKeyboard(lang: Lang, token: string) {
  const c = t(lang);
  const keyboard = new InlineKeyboard();
  QUESTION_COUNTS.forEach((count, index) => {
    keyboard.text(String(count), `gs:${token}:q:${count}`);
    if (index % 2 === 1) keyboard.row();
  });
  appendPickerNav(keyboard, lang, {
    back: `gs:${token}:dp:0`,
    cancel: `gs:${token}:cancel`,
  });
  return keyboard;
}

function playersKeyboard(lang: Lang, token: string) {
  const c = t(lang);
  const keyboard = new InlineKeyboard();
  for (let i = 0; i < PLAYER_COUNTS.length; i += 3) {
    for (const seats of PLAYER_COUNTS.slice(i, i + 3)) {
      keyboard.text(String(seats), `gs:${token}:p:${seats}`);
    }
    keyboard.row();
  }
  keyboard.text(c.groupDuelBack, `gs:${token}:back:q`);
  return keyboard;
}

function confirmKeyboard(lang: Lang, token: string) {
  const c = t(lang);
  return new InlineKeyboard()
    .text(c.groupDuelCreate, `gs:${token}:go`)
    .row()
    .text(c.groupDuelBack, `gs:${token}:back:p`)
    .text(c.groupDuelCancel, `gs:${token}:cancel`);
}

async function showSubjectPicker(
  ctx: Context,
  session: Ensured,
  token: string,
  page: number,
  edit = true,
) {
  const subjects = await loadSubjects(session);
  const c = t(session.lang);
  if (!session.profile.trackSlug) {
    await editOrReply(ctx, c.needTrack, emptyKeyboard(), edit);
    return;
  }
  if (!subjects.length) {
    await editOrReply(ctx, c.groupDuelNoQuestions, emptyKeyboard(), edit);
    return;
  }
  const markup = subjectSetupKeyboard(session.lang, subjects, token, page);
  await editOrReply(ctx, c.groupDuelPickSubject, markup, edit);
}

function lobbyText(lang: Lang, subjects: Subject[], duel: DuelView): string {
  const c = t(lang);
  const roster = duel.players.length
    ? duel.players
        .map((player, index) => `${index + 1}. ${esc(player.name)}${player.isHost ? " 👑" : ""}`)
        .join("\n")
    : c.groupDuelEmptyRoster;
  return fill(c.groupDuelLobby, {
    code: esc(duel.code),
    subject: esc(subjectLabel(subjects, duel.subjectSlug, lang)),
    count: duel.questionCount,
    filled: duel.playerCount,
    max: duel.maxPlayers,
    roster,
  });
}

function lobbyKeyboard(lang: Lang, duel: DuelView): InlineKeyboard | undefined {
  if (duel.status !== "waiting") return undefined;
  const c = t(lang);
  const keyboard = new InlineKeyboard();
  if (!duel.isFull) keyboard.text(c.groupDuelJoin, `gg:join:${duel.code}`);
  keyboard
    .row()
    .text(c.groupDuelStart, `gg:start:${duel.code}`)
    .text(c.groupDuelCancel, `gg:cancel:${duel.code}`);
  return keyboard;
}

async function renderLobby(
  ctx: Context,
  session: Ensured,
  duel: DuelView,
  edit: boolean,
) {
  const subjects = await loadSubjects(session);
  const text = lobbyText(session.lang, subjects, duel);
  const markup = lobbyKeyboard(session.lang, duel);
  const opts = {
    parse_mode: "HTML" as const,
    reply_markup: markup,
    link_preview_options: { is_disabled: true },
  };
  if (edit) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch (err) {
      if (isNotModified(err)) return;
    }
  }
  await ctx.reply(text, opts);
}

function roundText(lang: Lang, subjects: Subject[], round: RoundView): string {
  const c = t(lang);
  if (round.status === "completed") {
    const ranking = round.scores
      .map((row, index) => `${index + 1}. ${esc(row.name)} — ${row.score}`)
      .join("\n");
    const winner = round.winnerName
      ? fill(c.groupDuelWinner, { name: esc(round.winnerName) })
      : c.groupDuelDraw;
    return `${fill(c.groupDuelResults, { code: esc(round.code), ranking })}\n\n${winner}`;
  }

  const scores = round.scores.length
    ? round.scores.map((row) => `${esc(row.name)} ${row.score}`).join(" · ")
    : "—";
  let text =
    `${fill(c.groupDuelQuestion, {
      n: round.index + 1,
      total: round.questionCount,
      subject: esc(subjectLabel(subjects, round.subjectSlug, lang)),
    })}\n\n` +
    `${esc(truncate(round.questionText ?? "", 3400))}\n\n` +
    `${fill(c.groupDuelScores, { scores })}`;

  if (round.status === "reveal" && round.correctKey) {
    text += `\n\n${
      round.roundWinnerName
        ? fill(c.groupDuelCorrect, {
            name: esc(round.roundWinnerName),
            key: esc(round.correctKey),
          })
        : fill(c.groupDuelAnswerIs, { key: esc(round.correctKey) })
    }`;
    if (round.explanation) {
      text += `\n${fill(c.groupDuelExplain, { text: esc(truncate(round.explanation, 600)) })}`;
    }
  }
  return text;
}

function roundKeyboard(lang: Lang, round: RoundView): InlineKeyboard | undefined {
  const c = t(lang);
  if (round.status === "question") {
    const keyboard = new InlineKeyboard();
    round.options.forEach((option, index) => {
      keyboard.text(
        `${option.key}. ${truncate(option.text, 24)}`,
        `gg:a:${round.code}:${round.index}:${option.key}`,
      );
      if (index % 2 === 1) keyboard.row();
    });
    keyboard.row().text(c.groupDuelReveal, `gg:reveal:${round.code}`);
    return keyboard;
  }
  if (round.status === "reveal") {
    const isLast = round.index + 1 >= round.questionCount;
    return new InlineKeyboard().text(
      isLast ? c.groupDuelSeeResults : c.groupDuelNext,
      `gg:next:${round.code}`,
    );
  }
  if (round.status === "completed") {
    return new InlineKeyboard().text(c.groupDuelNewDuel, "gg:menu");
  }
  return undefined;
}

async function sendRound(
  ctx: Context,
  session: Ensured,
  subjects: Subject[],
  round: RoundView,
  edit: boolean,
) {
  const text = roundText(session.lang, subjects, round);
  const markup = roundKeyboard(session.lang, round);
  const opts = {
    parse_mode: "HTML" as const,
    reply_markup: markup,
    link_preview_options: { is_disabled: true },
  };
  if (edit) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch (err) {
      if (isNotModified(err)) return;
    }
  }
  await ctx.reply(text, opts);
}

async function handleSetupCallback(ctx: Context, data: string) {
  if (!ctx.from) return;
  const parts = data.split(":");
  const token = parts[1] ?? "";
  const action = parts[2] ?? "";
  const session = await ensureProfile(ctx.from);
  const lang = session.lang;
  const c = t(lang);

  const setup = await session.convex.query(api.groupDuels.getSetup, { token });
  if (!setup || setup.status !== "active") {
    await ctx.answerCallbackQuery({ text: c.groupDuelExpired, show_alert: true });
    return;
  }
  if (setup.ownerTelegramId !== session.telegramId) {
    await ctx.answerCallbackQuery({ text: c.groupDuelNotYours, show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();

  if (action === "cancel") {
    await session.convex.mutation(api.groupDuels.cancelSetup, {
      telegramId: session.telegramId,
      token,
    });
    await editOrReply(ctx, `⚠️ ${c.groupDuelCancel.replace(/^\S+\s*/, "")}`, emptyKeyboard(), true);
    return;
  }

  const subjects = await loadSubjects(session);

  if (action === "dp") {
    await showSubjectPicker(ctx, session, token, Number(parts[3]) || 0);
    return;
  }
  if (action === "d") {
    const subject = subjects[Number(parts[3])];
    if (!subject) {
      await ctx.reply(c.groupDuelExpired);
      return;
    }
    await session.convex.mutation(api.groupDuels.setSetupSubject, {
      telegramId: session.telegramId,
      token,
      subjectSlug: subject.slug,
    });
    const name = lang === "am" ? subject.nameAm : subject.nameEn;
    await editOrReply(
      ctx,
      fill(c.groupDuelPickQuestions, { subject: esc(name) }),
      countKeyboard(lang, token),
      true,
    );
    return;
  }
  if (action === "q") {
    const count = Number(parts[3]) || QUESTION_COUNTS[1];
    await session.convex.mutation(api.groupDuels.setSetupQuestions, {
      telegramId: session.telegramId,
      token,
      questionCount: count,
    });
    const fresh = await session.convex.query(api.groupDuels.getSetup, { token });
    await editOrReply(
      ctx,
      fill(c.groupDuelPickPlayers, {
        subject: esc(subjectLabel(subjects, fresh?.subjectSlug ?? null, lang)),
        count,
      }),
      playersKeyboard(lang, token),
      true,
    );
    return;
  }
  if (action === "p") {
    const seats = Number(parts[3]) || PLAYER_COUNTS[1];
    await session.convex.mutation(api.groupDuels.setSetupPlayers, {
      telegramId: session.telegramId,
      token,
      maxPlayers: seats,
    });
    const fresh = await session.convex.query(api.groupDuels.getSetup, { token });
    await editOrReply(
      ctx,
      fill(c.groupDuelConfirm, {
        subject: esc(subjectLabel(subjects, fresh?.subjectSlug ?? null, lang)),
        count: fresh?.questionCount ?? 0,
        players: seats,
      }),
      confirmKeyboard(lang, token),
      true,
    );
    return;
  }
  if (action === "back") {
    const target = parts[3];
    const fresh = await session.convex.query(api.groupDuels.getSetup, { token });
    const name = esc(subjectLabel(subjects, fresh?.subjectSlug ?? null, lang));
    if (target === "q") {
      await editOrReply(
        ctx,
        fill(c.groupDuelPickQuestions, { subject: name }),
        countKeyboard(lang, token),
        true,
      );
    } else if (target === "p") {
      await editOrReply(
        ctx,
        fill(c.groupDuelPickPlayers, { subject: name, count: fresh?.questionCount ?? 0 }),
        playersKeyboard(lang, token),
        true,
      );
    } else {
      await showSubjectPicker(ctx, session, token, 0);
    }
    return;
  }
  if (action === "go") {
    try {
      const duel = await session.convex.mutation(api.groupDuels.createGroupDuel, {
        telegramId: session.telegramId,
        token,
      });
      if (!duel) {
        await ctx.reply(c.groupDuelCreateFailed);
        return;
      }
      await renderLobby(ctx, session, duel, true);
    } catch (err) {
      await ctx.reply(errorMessage(err, lang));
    }
  }
}

async function handleGameCallback(ctx: Context, data: string) {
  if (!ctx.from) return;
  const session = await ensureProfile(ctx.from);
  const lang = session.lang;
  const c = t(lang);
  const parts = data.split(":");
  const action = parts[1] ?? "";
  const code = parts[2] ?? "";

  if (action === "menu") {
    await ctx.answerCallbackQuery();
    // Duel gets its own message so the /start explanation stays in place.
    await sendGroupDuelMenu(ctx, false);
    return;
  }
  if (action === "chat") {
    await ctx.answerCallbackQuery();
    const result = await session.convex.mutation(api.groupDuels.createSetup, {
      telegramId: session.telegramId,
      chatId: ctx.chat?.id ?? 0,
    });
    await showSubjectPicker(ctx, session, result.token, 0, true);
    return;
  }
  if (!code) {
    await ctx.answerCallbackQuery();
    return;
  }

  if (action === "join") {
    try {
      const duel = await session.convex.mutation(api.groupDuels.joinGroupDuel, {
        telegramId: session.telegramId,
        code,
        chatId: ctx.chat?.id,
      });
      await ctx.answerCallbackQuery({ text: c.groupDuelJoined });
      await renderLobby(ctx, session, duel, true);
    } catch (err) {
      await ctx.answerCallbackQuery({ text: errorMessage(err, lang), show_alert: true });
    }
    return;
  }

  if (action === "start") {
    try {
      const round = await session.convex.mutation(api.groupDuels.startGroupDuel, {
        telegramId: session.telegramId,
        code,
        chatId: ctx.chat?.id,
      });
      await ctx.answerCallbackQuery();
      const subjects = await loadSubjects(session);
      // Reuse the lobby message as the first question instead of posting a new one.
      await sendRound(ctx, session, subjects, round, true);
    } catch (err) {
      await ctx.answerCallbackQuery({ text: errorMessage(err, lang), show_alert: true });
    }
    return;
  }

  if (action === "cancel") {
    try {
      await session.convex.mutation(api.groupDuels.cancelGroupDuel, {
        telegramId: session.telegramId,
        code,
        chatId: ctx.chat?.id,
      });
      await ctx.answerCallbackQuery();
      try {
        await ctx.editMessageText(`⚠️ ${c.groupDuelCancel.replace(/^\S+\s*/, "")}`, {
          reply_markup: emptyKeyboard(),
        });
      } catch {
        // ignore
      }
    } catch (err) {
      await ctx.answerCallbackQuery({ text: errorMessage(err, lang), show_alert: true });
    }
    return;
  }

  if (action === "a") {
    const index = Number(parts[3]);
    const key = parts[4] ?? "";
    try {
      const result = await session.convex.mutation(api.groupDuels.answerGroupDuel, {
        telegramId: session.telegramId,
        code,
        index,
        key,
        chatId: ctx.chat?.id,
      });
      if (result.outcome === "correct") {
        await ctx.answerCallbackQuery({
          text: plain(
            fill(c.groupDuelCorrect, { name: result.round.roundWinnerName ?? "", key }),
          ),
        });
        const subjects = await loadSubjects(session);
        await sendRound(ctx, session, subjects, result.round, true);
      } else if (result.outcome === "wrong") {
        await ctx.answerCallbackQuery({ text: plain(c.groupDuelWrongTap) });
      } else if (result.outcome === "locked") {
        await ctx.answerCallbackQuery({ text: c.groupDuelLocked });
      } else if (result.outcome === "not_player") {
        await ctx.answerCallbackQuery({ text: c.groupDuelJoinFirst, show_alert: true });
      } else {
        await ctx.answerCallbackQuery({ text: c.groupDuelTooLate });
      }
    } catch (err) {
      await ctx.answerCallbackQuery({ text: errorMessage(err, lang), show_alert: true });
    }
    return;
  }

  if (action === "next") {
    try {
      const round = await session.convex.mutation(api.groupDuels.advanceGroupDuel, {
        telegramId: session.telegramId,
        code,
        chatId: ctx.chat?.id,
      });
      await ctx.answerCallbackQuery();
      const subjects = await loadSubjects(session);
      await sendRound(ctx, session, subjects, round, true);
    } catch (err) {
      await ctx.answerCallbackQuery({ text: errorMessage(err, lang), show_alert: true });
    }
    return;
  }

  if (action === "reveal") {
    try {
      const round = await session.convex.mutation(api.groupDuels.revealGroupDuel, {
        telegramId: session.telegramId,
        code,
        chatId: ctx.chat?.id,
      });
      await ctx.answerCallbackQuery();
      const subjects = await loadSubjects(session);
      await sendRound(ctx, session, subjects, round, true);
    } catch (err) {
      await ctx.answerCallbackQuery({ text: errorMessage(err, lang), show_alert: true });
    }
  }
}

export async function handleGroupDuelCallback(ctx: Context, data: string): Promise<boolean> {
  if (!ctx.from) return false;
  if (data.startsWith("gs:")) {
    await handleSetupCallback(ctx, data);
    return true;
  }
  if (data.startsWith("gg:")) {
    await handleGameCallback(ctx, data);
    return true;
  }
  return false;
}

export function isGroupDuelCallback(data: string | undefined): boolean {
  return Boolean(data?.startsWith("gs:") || data?.startsWith("gg:"));
}
