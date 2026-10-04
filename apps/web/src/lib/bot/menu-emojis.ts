import type { Lang } from "./copy";

/** Reply-keyboard actions that support optional Premium custom emoji icons. */
export type MainMenuAction =
  | "quiz"
  | "mock"
  | "daily"
  | "mistakes"
  | "stats"
  | "ranks"
  | "duel"
  | "tracks"
  | "history"
  | "settings"
  | "pro"
  | "how"
  | "support";

/** Button text sent when using icon_custom_emoji_id (no Unicode emoji prefix). */
export const MENU_PLAIN: Record<Lang, Record<MainMenuAction, string>> = {
  en: {
    quiz: "Quick 10",
    mock: "Full exam",
    daily: "Daily",
    mistakes: "Mistakes",
    stats: "Stats",
    ranks: "Ranks",
    duel: "Duel",
    tracks: "Track",
    history: "History",
    settings: "Settings",
    pro: "Pro",
    how: "How it works",
    support: "Support",
  },
  am: {
    quiz: "ፈጣን 10",
    mock: "ሙሉ ፈተና",
    daily: "ዛሬ",
    mistakes: "ተሳሳቱ",
    stats: "ውጤቴ",
    ranks: "ደረጃ",
    duel: "ዱኤል",
    tracks: "መንገድ",
    history: "ታሪክ",
    settings: "ቅንብሮች",
    pro: "ፕሮ",
    how: "እንዴት",
    support: "እገዛ",
  },
};

const ENV_KEYS: Record<MainMenuAction, string> = {
  quiz: "TELEGRAM_MENU_EMOJI_QUIZ",
  mock: "TELEGRAM_MENU_EMOJI_MOCK",
  daily: "TELEGRAM_MENU_EMOJI_DAILY",
  mistakes: "TELEGRAM_MENU_EMOJI_MISTAKES",
  stats: "TELEGRAM_MENU_EMOJI_STATS",
  ranks: "TELEGRAM_MENU_EMOJI_RANKS",
  duel: "TELEGRAM_MENU_EMOJI_DUEL",
  tracks: "TELEGRAM_MENU_EMOJI_TRACKS",
  history: "TELEGRAM_MENU_EMOJI_HISTORY",
  settings: "TELEGRAM_MENU_EMOJI_SETTINGS",
  pro: "TELEGRAM_MENU_EMOJI_PRO",
  how: "TELEGRAM_MENU_EMOJI_HOW",
  support: "TELEGRAM_MENU_EMOJI_SUPPORT",
};

/** Premium / Fragment custom emoji ID for a menu button, if configured in env. */
export function menuCustomEmojiId(action: MainMenuAction): string | undefined {
  const raw = process.env[ENV_KEYS[action]]?.trim();
  return raw || undefined;
}

export function menuPlainLabel(lang: Lang, action: MainMenuAction): string {
  return MENU_PLAIN[lang][action];
}

export function allMenuPlainLabels(): string[] {
  return [
    ...Object.values(MENU_PLAIN.en),
    ...Object.values(MENU_PLAIN.am),
  ];
}

export const REPLY_MENU_ORDER: MainMenuAction[] = [
  "quiz",
  "mock",
  "daily",
  "mistakes",
  "duel",
  "ranks",
  "pro",
  "history",
  "settings",
  "tracks",
  "how",
  "support",
];
