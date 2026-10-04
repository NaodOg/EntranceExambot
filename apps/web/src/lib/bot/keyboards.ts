import { InlineKeyboard, Keyboard } from "grammy";
import { t, type BotCopy, type Lang, type SessionMode } from "./copy";
import { REPLY_MENU_ORDER, type MainMenuAction } from "./menu-emojis";
import { addInlineMenuButton, addReplyMenuButton } from "./reply-menu";
import { appUrls } from "./urls";

function menuLabel(c: BotCopy, action: MainMenuAction): string {
  switch (action) {
    case "quiz":
      return c.quiz;
    case "mock":
      return c.mock;
    case "daily":
      return c.daily;
    case "mistakes":
      return c.mistakes;
    case "stats":
      return c.stats;
    case "ranks":
      return c.ranks;
    case "duel":
      return c.menuDuel;
    case "tracks":
      return c.menuTracks;
    case "history":
      return c.menuHistory;
    case "settings":
      return c.menuSettings;
    case "pro":
      return c.pro;
    case "how":
      return c.menuHow;
    case "support":
      return c.menuSupport;
  }
}

/** Appends the universal "back to menu" button used by every sub-screen. */
export function appendMenuButton(keyboard: InlineKeyboard, lang: Lang) {
  keyboard.row().text(t(lang).backToMenu, "nav:menu");
  return keyboard;
}

export function mainReplyKeyboard(lang: Lang) {
  const c = t(lang);
  const keyboard = new Keyboard();
  REPLY_MENU_ORDER.forEach((action, index) => {
    addReplyMenuButton(keyboard, lang, action, menuLabel(c, action));
    if (index % 2 === 1) keyboard.row();
  });
  return keyboard.resized().persistent();
}

export function languageKeyboard(lang: Lang = "en") {
  const c = t(lang);
  return new InlineKeyboard().text(c.langEn, "k:en").text(c.langAm, "k:am");
}

export type TrackPickerNav = "onboard" | "settings" | "quiz";

export function trackNavForContext(context: string): TrackPickerNav | undefined {
  if (context === "o") return "onboard";
  if (context === "s") return "settings";
  if (context === "q" || context === "m" || context === "d" || context === "k") return "quiz";
  return "quiz";
}

export function appendPickerNav(
  keyboard: InlineKeyboard,
  lang: Lang,
  actions: { back?: string; cancel?: string },
) {
  const c = t(lang);
  if (!actions.back && !actions.cancel) return keyboard;
  keyboard.row();
  if (actions.back) keyboard.text(c.groupDuelBack, actions.back);
  if (actions.cancel) keyboard.text(c.groupDuelCancel, actions.cancel);
  return keyboard;
}

export function trackKeyboard(
  tracks: Array<{ slug: string; nameEn: string; nameAm: string }>,
  lang: Lang,
  context: string,
  page: number,
  pageSize = 6,
  nav?: TrackPickerNav,
) {
  const keyboard = new InlineKeyboard();
  const sorted = [...tracks].sort((a, b) => {
    const left = lang === "am" ? a.nameAm : a.nameEn;
    const right = lang === "am" ? b.nameAm : b.nameEn;
    return left.localeCompare(right, lang === "am" ? "am" : "en", { sensitivity: "base" });
  });
  const start = page * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  for (const track of slice) {
    const label = lang === "am" ? track.nameAm : track.nameEn;
    keyboard.text(label.slice(0, 40), `t:${context}:${track.slug}`).row();
  }
  const c = t(lang);
  if (page > 0) keyboard.text(c.prev, `p:${context}:${page - 1}`);
  if (start + pageSize < sorted.length) {
    keyboard.text(c.nextPage, `p:${context}:${page + 1}`);
  }
  if (nav === "onboard") {
    appendPickerNav(keyboard, lang, { back: "nav:lang" });
  } else {
    appendMenuButton(keyboard, lang);
  }
  return keyboard;
}

/**
 * Subjects inside the chosen track. Paging uses the same `p:` prefix as the
 * track picker, disambiguated by the `sp:` (subject page) variant.
 */
export function subjectKeyboard(
  subjects: Array<{
    slug: string;
    nameEn: string;
    nameAm: string;
    maxMarks?: number;
  }>,
  lang: Lang,
  context: string,
  page: number,
  pageSize = 8,
  trackSlug?: string,
) {
  const keyboard = new InlineKeyboard();
  const sorted = [...subjects].sort((a, b) => {
    const left = lang === "am" ? a.nameAm : a.nameEn;
    const right = lang === "am" ? b.nameAm : b.nameEn;
    return left.localeCompare(right, lang === "am" ? "am" : "en", { sensitivity: "base" });
  });
  const start = page * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  for (const subject of slice) {
    const label = lang === "am" ? subject.nameAm : subject.nameEn;
    const suffix = subject.maxMarks ? ` · ${subject.maxMarks}` : "";
    keyboard
      .text(`${label.slice(0, 36)}${suffix}`, `sub:${context}:${subject.slug}`)
      .row();
  }
  const c = t(lang);
  if (page > 0) keyboard.text(c.prev, `sp:${context}:${trackSlug ?? "-"}:${page - 1}`);
  if (start + pageSize < sorted.length) {
    keyboard.text(c.nextPage, `sp:${context}:${trackSlug ?? "-"}:${page + 1}`);
  }
  if (trackSlug) {
    keyboard.text(c.changeTrack, `t:${context}:${trackSlug}`);
  }
  appendMenuButton(keyboard, lang);
  return keyboard;
}

const INLINE_CALLBACK: Partial<Record<MainMenuAction, string>> = {
  quiz: "m:quiz",
  mock: "m:mock",
  daily: "m:daily",
  mistakes: "m:mistakes",
  stats: "m:stats",
  ranks: "m:ranks",
  tracks: "m:track",
  settings: "m:set",
  pro: "m:pro",
  how: "sk:how",
  support: "sk:sup",
};

const MAIN_MENU_ROWS: MainMenuAction[][] = [
  ["quiz", "mock"],
  ["daily", "duel"],
  ["pro", "mistakes"],
  ["settings", "history"],
  ["tracks", "ranks"],
  ["how", "support"],
];

export function mainInlineMenu(lang: Lang) {
  const c = t(lang);
  const keyboard = new InlineKeyboard();
  for (const row of MAIN_MENU_ROWS) {
    row.forEach((action, index) => {
      const label = menuLabel(c, action);
      if (action === "duel") {
        keyboard.webApp(label, appUrls.duelLobby());
      } else if (action === "history") {
        keyboard.webApp(label, appUrls.history());
      } else {
        const data = INLINE_CALLBACK[action];
        if (data) addInlineMenuButton(keyboard, lang, action, label, data);
      }
      if (index % 2 === 1) keyboard.row();
    });
  }
  keyboard.webApp(c.openApp, appUrls.home());
  return keyboard;
}

export function questionKeyboard(token: string, optionKeys: string[], lang: Lang) {
  const c = t(lang);
  const keyboard = new InlineKeyboard();
  const keys = optionKeys.length ? optionKeys : ["A", "B", "C", "D"];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i] ?? "A";
    keyboard.text(key, `a:${token}:${key}`);
    if (i % 2 === 1) keyboard.row();
  }
  if (keys.length % 2 === 1) keyboard.row();
  keyboard.text(c.skip, `s:${token}`).text(c.end, `x:${token}`);
  return keyboard;
}

export function feedbackKeyboard(token: string, isLast: boolean, lang: Lang) {
  const c = t(lang);
  return new InlineKeyboard().text(isLast ? c.seeResults : c.next, `n:${token}`);
}

export function scoreKeyboard(
  lang: Lang,
  opts: {
    mode: SessionMode;
    attemptId?: string;
  },
) {
  const c = t(lang);
  const keyboard = new InlineKeyboard();
  if (opts.attemptId) {
    keyboard.webApp(c.openReview, appUrls.review(opts.attemptId));
  }
  if (opts.mode === "quick") keyboard.text(c.another10, "m:quiz");
  else if (opts.mode === "mock") keyboard.text(c.anotherMock, "m:mock");
  else if (opts.mode === "daily") keyboard.text(c.daily, "m:daily");
  else keyboard.text(c.mistakes, "m:mistakes");
  keyboard.row().text(c.backToMenu, "m:menu").webApp(c.openApp, appUrls.home());
  return keyboard;
}

export function confirmSessionKeyboard(
  lang: Lang,
  token: string,
  mode: SessionMode,
  source?: "mock" | "past" | "all",
  examId?: string,
  subjectSlug?: string,
) {
  const c = t(lang);
  const short =
    mode === "quick" ? "q" : mode === "mock" ? "m" : mode === "daily" ? "d" : "k";
  // The subject rides along so "start new" does not fall back to the picker.
  const startNew = ["f", short, source ?? "", examId ?? "", subjectSlug ?? ""]
    .join(":")
    .replace(/:+$/, "");
  const keyboard = new InlineKeyboard()
    .text(c.continueSession, `c:${token}`)
    .text(c.startNew, startNew);
  appendMenuButton(keyboard, lang);
  return keyboard;
}

export function quotaKeyboard(lang: Lang) {
  const c = t(lang);
  const keyboard = new InlineKeyboard()
    .text(c.pro, "m:pro")
    .webApp(c.openPro, appUrls.pro());
  appendMenuButton(keyboard, lang);
  return keyboard;
}

/** Web App buttons only work in private chats; groups need URL buttons. */
export function appOpenRow(label: string, url: string, useUrlButton: boolean) {
  const keyboard = new InlineKeyboard();
  if (useUrlButton) {
    keyboard.url(label, url);
  } else {
    keyboard.webApp(label, url);
  }
  return keyboard;
}

export function duelLobbyKeyboard(lang: Lang, useUrlButton: boolean) {
  const c = t(lang);
  const keyboard = new InlineKeyboard();
  if (useUrlButton) {
    keyboard
      .url(c.sourceMock, appUrls.duelLobby("mock"))
      .url(c.sourcePast, appUrls.duelLobby("past"));
  } else {
    keyboard
      .webApp(c.sourceMock, appUrls.duelLobby("mock"))
      .webApp(c.sourcePast, appUrls.duelLobby("past"));
  }
  return keyboard;
}

export function webAppRow(label: string, url: string) {
  return new InlineKeyboard().webApp(label, url);
}

export const MODE_SHORT: Record<string, SessionMode> = {
  q: "quick",
  m: "mock",
  d: "daily",
  k: "mistakes",
};
