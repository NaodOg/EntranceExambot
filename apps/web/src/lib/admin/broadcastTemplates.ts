import type { AudienceDraft, ButtonDraft } from "@/components/admin/broadcasts";

/**
 * Ready-made broadcast drafts for the admin panel. Each template fills the
 * composer's message (EN + AM), buttons, and suggested audience filters.
 * Placeholders {name} {firstName} {streak} {xp} {track} {subject} are resolved
 * per user. `{dept}` is a legacy alias for `{track}` and still renders.
 */
export type BroadcastTemplate = {
  id: string;
  label: string;
  description: string;
  bodyEn: string;
  bodyAm: string;
  buttons?: ButtonDraft[];
  audience?: Partial<AudienceDraft>;
};

const PRO_BUTTON: ButtonDraft[] = [
  {
    row: 0,
    labelEn: "⭐ Upgrade to Pro",
    labelAm: "⭐ ወደ Pro ያሻሽሉ",
    action: "mini_app",
    value: "/pro",
  },
];

const QUIZ_BUTTON: ButtonDraft[] = [
  {
    row: 0,
    labelEn: "▶️ Start quiz",
    labelAm: "▶️ ጥያቄ ጀምሩ",
    action: "menu",
    value: "quiz",
  },
];

export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    id: "welcome",
    label: "👋 Welcome new student",
    description: "Warm intro for fresh signups — points at the first quiz.",
    bodyEn:
      "👋 <b>Welcome, {firstName}!</b>\n\nYou just joined Ethiopia's smartest matric prep app. Here is how to get the most out of it:\n\n1️⃣ Take a quick 10-question warm-up\n2️⃣ Build a daily streak 🔥\n3️⃣ Track your weak spots automatically\n\nYour track: <b>{track}</b>\n\nReady for your first quiz?",
    bodyAm:
      "👋 <b>እንኳን ደህና መጣህ {firstName}!</b>\n\nከኢትዮጵያ በጣም ጠንካራ የመውጫ ፈተና ዝግጅት መተግበሪያ ጋር ተቀላቅለሃል። እንዴት እንደምትጠቀም፦\n\n1️⃣ በ10 ጥያቄ አጭር ልምምድ ጀምር\n2️⃣ የዕለት ቀን ስትሪክህን ገንባ 🔥\n3️⃣ ደካማ ቦታህን በራስህ ተከታተል\n\nየመንገድህ፦ <b>{track}</b>\n\nየመጀመሪያ ጥያቄህን ለመጀመር ተዘጋጅተሃል?",
    buttons: QUIZ_BUTTON,
  },
  {
    id: "pro-upsell",
    label: "⭐ Pro upsell",
    description: "Show free users what Pro unlocks. Audience: free users.",
    bodyEn:
      "⭐ <b>{firstName}, you're leaving questions on the table.</b>\n\nFree plan gives you a taste — <b>Pro</b> gives you everything:\n\n✅ Unlimited mock exams\n✅ Full question bank for every track\n✅ Mistake drill with smart repeats\n✅ 1v1 duels anytime\n✅ Switch tracks whenever you want\n\nAll for less than the price of one coffee per week. ☕",
    bodyAm:
      "⭐ <b>{firstName}፣ አንዳች ጥያቄዎች እየሰደዱ ነው!</b>\n\nነጻ እቅድ ጣዕሙን ብቻ ነው የሚሰጠው — <b>Pro</b> ን ብትወስድ ሁሉም ይከፈታል፦\n\n✅ ያለ ገደብ mock ፈተናዎች\n✅ ለሁሉም ክፍሎች ሙሉ የጥያቄ ባንክ\n✅ ስህተት ድግግሞሽ ልምምድ\n✅ በማንኛውም ጊዜ 1v1 duel\n✅ የትምህርት ክፍል መቀየር\n\nበሳምንት አንድ የቡና ዋጋ ብቻ! ☕",
    buttons: PRO_BUTTON,
    audience: { all: false, pro: "free" },
  },
  {
    id: "streak-saver",
    label: "🔥 Streak saver (streak ≥ 3)",
    description: "Morning nudge for active students who haven't practiced today.",
    bodyEn:
      "🔥 <b>{firstName}, don't break the chain!</b>\n\nYour streak is at <b>{streak} days</b> — one quick quiz today keeps it alive. It takes less than 5 minutes.",
    bodyAm:
      "🔥 <b>{firstName}፣ ሰንሰለቱን አትቋርጥ!</b>\n\nስትሪክህ <b>{streak} ቀናት</b> ላይ ነው — ዛሬ አንድ አጭር ጥያቄ ብትሰራ ይቀጥላል። ከ5 ደቂቃ አይበልጥም።",
    buttons: QUIZ_BUTTON,
    audience: { all: false, pro: "any", minStreak: 3, activeWithinDays: 2 },
  },
  {
    id: "daily-question",
    label: "📅 Daily question push",
    description: "Daily featured question with one-tap start.",
    bodyEn:
      "📅 <b>Today's question is ready, {firstName}!</b>\n\nA fresh hand-picked question from your <b>{subject}</b> question bank is waiting. Answer it now and keep your daily goal on track 🎯",
    bodyAm:
      "📅 <b>የዛሬ ጥያቄ ተዘጋጅቷል {firstName}!</b>\n\nከ<b>{subject}</b> የጥያቄ ባንክህ በተመረጠ አዲስ ጥያቄ ይጠብትሃል። አሁን መልሰው የዕለት ግብህን አቆይ 🎯",
    buttons: QUIZ_BUTTON,
  },
  {
    id: "new-exam-drop",
    label: "🆕 New exam drop",
    description: "Announce freshly imported exams. Edit the year before sending.",
    bodyEn:
      "🆕 <b>Fresh exams just landed!</b>\n\nWe just added new <b>{track}</b> papers to the bank — real past questions, full explanations.\n\nBe among the first to try them 👇",
    bodyAm:
      "🆕 <b>አዲስ ፈተናዎች ገብተዋል!</b>\n\nአዲስ የ<b>{track}</b> ሰርጦች ተጨምረዋል — እውነተኛ ያለፉ ጥያቄዎች፣ ሙሉ ማብራሪያ።\n\nከመጀመሪያዎቹ መካከል ኾነህ ይሞክሩት 👇",
    buttons: [
      {
        row: 0,
        labelEn: "📚 Open exam player",
        labelAm: "📚 ፈተና ክፈት",
        action: "mini_app",
        value: "/exam",
      },
    ],
  },
  {
    id: "re-engage",
    label: "😴 Come back (inactive 7+ days)",
    description: "Win back students who went quiet.",
    bodyEn:
      "😴 <b>{firstName}, your streak misses you.</b>\n\nIt's been a while since your last practice. Your {track} papers are closer than you think — a 10-question warm-up is the easiest way to get back in rhythm 💪",
    bodyAm:
      "😴 <b>{firstName}፣ ስትሪክህ እጅህን ይፈልጋል!</b>\n\nከመጨረሻው ልምምድ ጥቂት ጊዜዎች አሉ። የ{track} ሰርጦችህ ከሚያስብህ በጣም ቅርብ ነው — በ10 ጥያቄ መመለስ ቀላሉ መንገድ ነው 💪",
    buttons: QUIZ_BUTTON,
    audience: { all: false, pro: "any", inactiveForDays: 7 },
  },
  {
    id: "season-countdown",
    label: "⏳ Exam season countdown",
    description: "Urgency push near the national exam date. Edit dates before sending.",
    bodyEn:
      "⏳ <b>The clock is ticking, {firstName}!</b>\n\nThe national matric exam is around the corner. Every mock exam you take now is a question you won't fumble in the real hall.\n\nHow ready are you? Take a full timed mock today 🏁",
    bodyAm:
      "⏳ <b>ጊዜው እየተራመደ ነው {firstName}!</b>\n\nብሔራዊው መውጫ ፈተና ጥቂት ቀናት ቀርቶት ነው። አሁን የምትወስድ እያንዳንዱ mock ፈተና በእውነተኛው ክፍለ ጊዜ የማትሳካት ጥያቄ ነው።\n\nምን ያህል ተዘጋጅተሃል? ዛሬ ሙሉ ፈተና ውሰድ 🏁",
    buttons: [
      {
        row: 0,
        labelEn: "🏁 Take full mock",
        labelAm: "🏁 ሙሉ ፈተና ውሰድ",
        action: "menu",
        value: "mock",
      },
    ],
  },
  {
    id: "duel-invite",
    label: "⚔️ Duel challenge",
    description: "Promote 1v1 duels. Audience: active users.",
    bodyEn:
      "⚔️ <b>Think you're the best in {track}, {firstName}?</b>\n\nChallenge classmates to a real-time 1v1 duel — same questions, same clock, one winner. Climb the duel board and defend your crown 👑",
    bodyAm:
      "⚔️ <b>በ{track} እርስህ ተረምዳ እንደሆንህ ታምናለህ {firstName}?</b>\n\nከክፍል ጓደኞችህ ጋር በቅጽበታዊ 1v1 duel ተዋጋ — ተመሳሳይ ጥያቄ፣ ተመሳሳይ ጊዜ፣ አንድ አሸናፊ። Duel ሰሌዳውን ወጥተህ አንቋሽፈህ 👑",
    buttons: [
      {
        row: 0,
        labelEn: "⚔️ Enter duel lobby",
        labelAm: "⚔️ Duel ግቢ ግባ",
        action: "mini_app",
        value: "/duel",
      },
    ],
    audience: { all: false, pro: "any", activeWithinDays: 3 },
  },
  {
    id: "pro-approved",
    label: "✅ Payment received (Pro users)",
    description: "Thank students whose Pro payment was approved. Audience: pro users.",
    bodyEn:
      "✅ <b>Payment confirmed — welcome to Pro, {firstName}!</b>\n\nYour account is unlocked: unlimited mocks, every track, mistake drills, and duels. Go crush it 💪\n\nIf you ever have a question, just tap Support.",
    bodyAm:
      "✅ <b>ክፍያህ ተረጋግጧል — እንኳን ደህና ባለ Pro ሆንህ {firstName}!</b>\n\nመለያህ ተከፈተ፦ ያለ ገደብ mock፣ ሁሉም ክፍሎች፣ የስህተት ልምምድ እና duels። ሂደው ብላ 💪\n\nጥያቄ ካለህ ሁልጊዜ Support ይጫኑ።",
    buttons: [
      {
        row: 0,
        labelEn: "🚀 Start with a mock",
        labelAm: "🚀 በmock ጀምር",
        action: "menu",
        value: "mock",
      },
    ],
    audience: { all: false, pro: "pro" },
  },
  {
    id: "leaderboard",
    label: "🏆 Leaderboard push",
    description: "Weekly spotlight on track rankings.",
    bodyEn:
      "🏆 <b>{firstName}, the {track} board just reshuffled!</b>\n\nTop students are stacking XP fast — {xp} points won't hold a top spot forever. One strong mock tonight could move you up 10 places 📈",
    bodyAm:
      "🏆 <b>{firstName}፣ የ{track} ሰሌዳ ተቀየቋል!</b>\n\nከፍተኛ ተማሪዎች XP በፍጥነት ይሰበስባሉ — {xp} ነጥብ ለዘላለም አይቆይም። ዛሬ ማታ አንድ ጠንካራ mock ብትወስድ 10 ደረጃዎች ላይ ሊያወጣህ ይችላል 📈",
    buttons: [
      {
        row: 0,
        labelEn: "🏆 See rankings",
        labelAm: "🏆 ደረጃዎችን ተመልከት",
        action: "mini_app",
        value: "/leaderboard",
      },
    ],
  },
  {
    id: "maintenance",
    label: "🛠️ Maintenance notice",
    description: "Heads-up before planned downtime. Edit times before sending.",
    bodyEn:
      "🛠️ <b>Quick heads-up, {firstName}</b>\n\nExam Bot will be briefly unavailable tonight while we roll out improvements. Your streak, XP and progress are all safe — nothing will be lost.\n\nSee you on the other side 🙏",
    bodyAm:
      "🛠️ <b>አጭር ማስታወሻ {firstName}</b>\n\nExam Bot ዛሬ ማታ ማሻሻያ ስንጭን ለአጭር ጊዜ ላይሰራ ይችላል። ስትሪክህ፣ XPህ እና እድገትህ የተጠበቁ ናቸው — ምንም አይጠፋም።\n\nከጥቂት አናገኝህ 🙏",
  },
];

/** Web app destinations for broadcast buttons (paths resolve against the Mini App base URL). */
export const WEBAPP_DESTINATIONS: { value: string; label: string }[] = [
  { value: "home", label: "🏠 Web app home" },
  { value: "/exam", label: "📝 Exam player" },
  { value: "/practice", label: "🎯 Practice" },
  { value: "/duel", label: "⚔️ Duel lobby" },
  { value: "/leaderboard", label: "🏆 Leaderboard" },
  { value: "/mistakes", label: "🩹 Mistake drill" },
  { value: "/pro", label: "⭐ Pro upgrade" },
  { value: "/history", label: "🕘 History" },
  { value: "/review", label: "🔍 Review" },
  { value: "/notes", label: "🗒️ Notes" },
  { value: "/account", label: "⚙️ Account" },
];