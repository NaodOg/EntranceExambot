const botUsername =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "EntranceExamStudybot";

/**
 * Deep link that launches the bot's Mini App from outside Telegram (e.g. a URL
 * button in a group, where `web_app` buttons are not allowed).
 */
export function buildMiniAppLink(startParam?: string): string {
  const base = `https://t.me/${botUsername}`;
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}

export function buildDuelInviteLink(code: string): string {
  return `https://t.me/${botUsername}?start=duel_${code.toUpperCase()}`;
}

export function buildDuelInviteMessage(
  subjectName: string,
  code: string,
  extras?: { questionCount?: number; maxPlayers?: number },
): string {
  const link = buildDuelInviteLink(code);
  const questions = extras?.questionCount ?? 10;
  const seats = extras?.maxPlayers ?? 10;
  return (
    `⚔️ Join my Matric Duel (${subjectName}) — ${questions} questions, up to ${seats} players. Same paper. Highest score wins.\n\n` +
    `Code: ${code.toUpperCase()}\n` +
    `Accept: ${link}`
  );
}

export function buildDuelTelegramShareLink(
  subjectName: string,
  code: string,
  extras?: { questionCount?: number; maxPlayers?: number },
): string {
  return `https://t.me/share/url?text=${encodeURIComponent(
    buildDuelInviteMessage(subjectName, code, extras),
  )}`;
}

export function buildGiftInviteLink(code: string): string {
  return `https://t.me/${botUsername}?start=gift_${code.toUpperCase()}`;
}

/** Tracked campaign link: opens the bot and records the start. */
export function buildTrackedLink(code: string): string {
  return `https://t.me/${botUsername}?start=link_${code.toUpperCase()}`;
}

export function buildGiftInviteMessage(senderName: string, code: string): string {
  const link = buildGiftInviteLink(code);
  return (
    `${senderName} sent you MatricPrep Pro — unlimited mocks until exam season ends.\n\n` +
    `Redeem code: ${code.toUpperCase()}\n` +
    `Open: ${link}`
  );
}

export function buildGiftTelegramShareLink(senderName: string, code: string): string {
  return `https://t.me/share/url?text=${encodeURIComponent(
    buildGiftInviteMessage(senderName, code),
  )}`;
}
