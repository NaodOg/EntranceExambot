import type { CatalogRow } from "./catalog";

export type TranslationSection = "bot" | "webapp" | "groups";

type GroupKey = { namespace: string; key: string };

export const SECTION_META: Record<
  TranslationSection,
  { label: string; short: string; description: string }
> = {
  bot: {
    label: "Bot",
    short: "Bot",
    description: "Private chat commands, onboarding, quizzes, pro and payments.",
  },
  webapp: {
    label: "Web app",
    short: "App",
    description: "Mini app screens: home, practice, results, leaderboard and Pro.",
  },
  groups: {
    label: "Groups",
    short: "Groups",
    description: "Group chat info and the in-chat duel race.",
  },
};

export const SECTION_ORDER: TranslationSection[] = ["bot", "webapp", "groups"];

/** Prefix rules (longest match wins). Applied when no explicit token matches. */
const PREFIX_GROUPS: Array<[TranslationSection, string, string]> = [
  ["groups", "Duel race", "groupDuel"],
  ["groups", "Group start & help", "group"],
  ["bot", "How it works & support", "howItWorks"],
  ["bot", "How it works & support", "support"],
  ["bot", "Pro & payments", "pro"],
  ["webapp", "Home arcade", "home"],
  ["webapp", "Study notes", "notes"],
  ["webapp", "Restrictions & upsell", "restrict"],
  ["webapp", "Pro checkout", "proPage"],
  ["webapp", "Pro checkout", "proCheckout"],
  ["webapp", "Pro checkout", "proPayment"],
  ["webapp", "Pro checkout", "proAttach"],
  ["webapp", "Pro checkout", "proImage"],
  ["webapp", "Pro checkout", "proUpload"],
  ["webapp", "Pro checkout", "proSubmitted"],
  ["webapp", "Pro checkout", "proProcessing"],
  ["webapp", "Pro checkout", "proScreenshot"],
  ["webapp", "Pro member hub", "proHero"],
  ["webapp", "Pro member hub", "proAccess"],
  ["webapp", "Pro member hub", "proUntil"],
  ["webapp", "Pro member hub", "proMember"],
  ["webapp", "Pro member hub", "proGift"],
  ["webapp", "Redeem gifts", "redeem"],
  ["webapp", "Exam sources", "source"],
  ["webapp", "Exam sitting size", "countPick"],
  ["webapp", "Leaderboard", "board"],
  ["webapp", "Leaderboard", "period"],
  ["webapp", "Help & support", "howItWorks"],
  ["webapp", "Help & support", "support"],
];

/** Ordered group tables. Longest matching token wins, so specific keys beat prefixes. */
const BOT_GROUPS: Array<[string, string[]]> = [
  [
    "Menu & commands",
    [
      "menuDuel",
      "menuTracks",
      "menuHistory",
      "menuSettings",
      "menuHow",
      "menuSupport",
      "menuTitle",
      "menu",
      "quiz",
      "mock",
      "daily",
      "stats",
      "ranks",
      "more",
      "mistakes",
      "pro",
      "help",
      "cmd",
    ],
  ],
  [
    "Onboarding",
    ["welcome", "onboardLang", "onboardDept", "onboardDone", "trackLocked", "changeDeptPro"],
  ],
  [
    "Practice session",
    [
      "qProgress",
      "skip",
      "end",
      "next",
      "seeResults",
      "correct",
      "wrong",
      "another10",
      "anotherMock",
      "mainMenu",
      "scoreTitle",
      "scoreBody",
      "quotaLeft",
      "quotaPro",
      "emptyQuiz",
      "activeSession",
      "continueSession",
      "startNew",
      "cancelled",
      "noActive",
      "sourcePick",
      "sourceMock",
      "sourcePast",
      "sourceAll",
      "sourceMockEmpty",
      "sourcePastEmpty",
      "mockPick",
      "mockCapped",
      "dailyPick",
      "pastPick",
    ],
  ],
  ["Stats & ranks", ["statsBody", "lastScore", "noLast", "noDeptStats", "ranksTitle", "ranksEmpty", "yourRank"]],
  [
    "Settings",
    [
      "settingsTitle",
      "settingsBody",
      "changeGoal",
      "goalPick",
      "goalSaved",
      "langEn",
      "langAm",
      "changeLang",
      "changeDept",
      "saved",
    ],
  ],
  [
    "Pro & payments",
    [
      "proTitle",
      "proBody",
      "proActive",
      "proPending",
      "proRejected",
      "ivePaid",
      "proCancel",
      "proCancelled",
      "sendPhoto",
      "sendPhotoNeed",
      "proSubmitted",
      "proTooBig",
      "proUploadFailed",
      "proApproved",
      "proDenied",
    ],
  ],
  [
    "Duel & app links",
    [
      "duelPitch",
      "duelAccept",
      "duelPlayInApp",
      "historyPitch",
      "openApp",
      "openTimedQuiz",
      "openTimedMock",
      "openMistakes",
      "openDuel",
      "openHistory",
      "openReview",
      "openTheme",
      "openPro",
      "openRanks",
      "trackedLinkInvite",
      "openLink",
      "needDept",
      "noQuestions",
      "notProMistakes",
      "noMistakes",
    ],
  ],
  [
    "Quota & errors",
    ["quotaGone", "unknown", "expired", "stale"],
  ],
  [
    "Modes & pushes",
    [
      "modeQuick",
      "modeMock",
      "modeDaily",
      "modeMistakes",
      "dailyPush",
      "answerDaily",
      "streakPush",
      "saveStreak",
    ],
  ],
  [
    "Misc labels",
    [
      "studentFallback",
      "xpUnit",
      "langName",
      "questionUnit",
      "giftAccept",
      "giftRedeem",
      "duelJoinFailed",
    ],
  ],
  ["Pagination & misc", ["moreTitle", "morePrompt", "page", "prev", "nextPage"]],
];

const APP_GROUPS: Array<[string, string[]]> = [
  [
    "Practice setup",
    [
      "sourceMock",
      "sourcePast",
      "sourceAll",
      "sourcePick",
      "sourceBlurb",
      "sourceMockHint",
      "sourceMockCount",
      "sourceMockEmpty",
      "sourcePastHint",
      "sourcePastEmpty",
      "sourcePastKicker",
      "sourcePastTitle",
      "sourcePastBody",
      "sourceMockSub",
      "sourcePastSub",
      "sourceAllHint",
      "sourceAllCount",
      "sourceAllEmpty",
      "sourceNeedPick",
      "questionBank",
      "countPick",
      "practiceMockHint",
      "quickDrill",
      "continueMock",
      "tracks",
      "pickTrack",
      "deptChoose",
      "trackLocked",
      "changeTrackPro",
    ],
  ],
  [
    "Onboarding & preferences",
    [
      "onb",
      "onboardingTitle",
      "language",
      "theme",
      "accent",
      "fontSize",
      "dailyGoal",
      "haptics",
      "sound",
      "instant",
      "motion",
      "university",
      "yearOfStudy",
      "year",
      "examYear",
      "save",
      "next",
      "finish",
    ],
  ],
  [
    "Leaderboard & progression",
    [
      "hallOfFame",
      "scoreboard",
      "yourStanding",
      "changeTrack",
      "yourTrack",
      "noPeriodPlayers",
      "noPlayers",
      "unrankedPeriod",
      "streak",
      "xp",
      "free",
      "proActive",
      "upgrade",
    ],
  ],
  [
    "Results & review",
    [
      "score",
      "timeUp",
      "pencilsDown",
      "timeUpBody",
      "seeResults",
      "posting",
      "review",
      "backHome",
      "pending",
      "rejected",
      "submitPay",
      "noQuestions",
    ],
  ],
  ["Shell & navigation", ["shell", "home"]],
  ["Exam sitting", ["exam"]],
  ["Duel rooms", ["duel"]],
  ["Progress pages", ["prog"]],
  ["Pro & account", ["proApp"]],
  ["Navigation & brand", ["brand", "selam", "student", "account", "history", "practice", "pro", "saving", "seeMore", "showMore"]],
];

const GROUP_GROUPS: Array<[string, string[]]> = [
  [
    "Group start & help",
    ["groupStart", "groupStartDuel", "groupHelp", "groupUsePrivate", "groupOpenPrivate", "groupCallbackAlert"],
  ],
  [
    "Duel setup",
    [
      "groupDuelMenu",
      "groupDuelInApp",
      "groupDuelInChat",
      "groupDuelPickDept",
      "groupDuelPickQuestions",
      "groupDuelPickPlayers",
      "groupDuelConfirm",
      "groupDuelCreate",
      "groupDuelBack",
      "groupDuelCancel",
      "groupDuelNotYours",
      "groupDuelExpired",
      "groupDuelNoQuestions",
      "groupDuelNotEnough",
      "groupDuelCreateFailed",
      "groupDuelLobby",
      "groupDuelEmptyRoster",
    ],
  ],
];

function tableFor(section: TranslationSection) {
  if (section === "webapp") return APP_GROUPS;
  if (section === "groups") return GROUP_GROUPS;
  return BOT_GROUPS;
}

export function sectionForRow(row: GroupKey): TranslationSection {
  if (row.namespace === "app") return "webapp";
  return row.key.startsWith("group") ? "groups" : "bot";
}

function matchPrefix(row: CatalogRow): string | null {
  const section = sectionForRow(row);
  let best: { length: number; label: string } | null = null;
  for (const [ruleSection, label, prefix] of PREFIX_GROUPS) {
    if (ruleSection !== section) continue;
    if (row.key.startsWith(prefix) && (!best || prefix.length > best.length)) {
      best = { length: prefix.length, label };
    }
  }
  return best?.label ?? null;
}

/** Which sub-group a key belongs to (longest matching token wins). */
export function groupForRow(row: CatalogRow): string {
  const table = tableFor(sectionForRow(row));
  let best: { length: number; label: string } | null = null;
  for (const [label, tokens] of table) {
    for (const token of tokens) {
      if ((row.key === token || row.key.startsWith(token)) && (!best || token.length > best.length)) {
        best = { length: token.length, label };
      }
    }
  }
  if (best) return best.label;
  return matchPrefix(row) ?? "General";
}

/** Group labels in display order for a section, with "General" last. */
export function groupOrder(section: TranslationSection): string[] {
  const ordered = tableFor(section).map(([label]) => label);
  for (const [ruleSection, label] of PREFIX_GROUPS) {
    if (ruleSection === section && !ordered.includes(label)) ordered.push(label);
  }
  ordered.push("General");
  return ordered;
}
