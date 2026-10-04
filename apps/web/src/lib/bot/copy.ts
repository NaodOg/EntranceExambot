import { allMenuPlainLabels, MENU_PLAIN, type MainMenuAction } from "./menu-emojis";

export type Lang = "en" | "am";
export type SessionMode = "quick" | "mock" | "daily" | "mistakes";

export const botCopy = {
  en: {
    quiz: "⚡ Quick 10",
    mock: "📝 Full exam",
    daily: "🎯 Daily",
    stats: "📊 Stats",
    ranks: "🏆 Ranks",
    more: "⚙️ More",
    mistakes: "🧠 Mistakes",
    pro: "⭐ Pro",
    menuDuel: "⚔️ Duel",
    menuTracks: "🧭 Track",
    menuHistory: "📖 History",
    menuSettings: "⚙️ Settings",
    menuHow: "💡 How it works",
    menuSupport: "💬 Support",
    welcome:
      "Selam{name}! Study for the matric exam right here in chat.\n\nPick a button below, or type /help.",
    onboardLang: "Choose your language",
    onboardTrack:
      "Choose your track.\n\n⚠️ Choose carefully. After setup you cannot change track unless you upgrade to Pro.",
    trackLocked: "Track is locked on the free plan. Upgrade to Pro to switch.",
    changeTrackPro: "⭐ Change with Pro",
    onboardDone: "You're set. Track: <b>{track}</b>.",
    onboardSubject:
      "Now pick your subjects.\n\nAdd more any time from Settings.",
    onboardSubjectDone:
      "You're all set. <b>{track}</b> · <b>{subject}</b> is your first subject.\n\nPick a button below.",
    pickSubject: "Which subject?",
    needSubject: "Pick a subject first.",
    menuTitle: "What do you want to do?",
    help:
      "<b>Commands</b>\n" +
      "/quiz — Quick 10 in chat\n" +
      "/exam — Full exam in chat\n" +
      "/daily — Daily goal sitting\n" +
      "/mistakes — Mistake drill (Pro)\n" +
      "/stats — XP, streak, quota\n" +
      "/ranks — Track leaderboard\n" +
      "/settings — Language, track & daily goal\n" +
      "/how — How it works\n" +
      "/support — Help & contact\n" +
      "/pro — Upgrade\n" +
      "/duel — Duel room (opens app)\n" +
      "/history — Past attempts (opens app)\n" +
      "/cancel — Stop the current quiz\n" +
      "/menu — Show the menu",
    openApp: "📱 Open study app",
    trackedLinkInvite: "You're in! Tap below to start studying.",
    openLink: "🔗 Open link",
    openTimedQuiz: "⏱ Timed Quick 10 in app",
    openTimedMock: "⏱ Timed full exam in app",
    openMistakes: "🧠 Open Mistake Vault",
    openDuel: "⚔️ Join duel in bot",
    openHistory: "📖 Open history",
    openReview: "📖 Review in app",
    openTheme: "🎨 Change theme in app",
    openPro: "📱 Upload in app",
    openRanks: "🏆 Open Hall of Fame",
    duelPitch:
      "Duel rooms use a shared paper and a timer in the study app.\n\n2–10 players. Pick the question bank, then open the lobby.",
    duelAccept:
      "You've been invited to a Duel.\n\nCode: <b>{code}</b>\n\nTap below to join, then play in the app.",
    historyPitch: "Attempt history and per-question review are in the study app.",
    needTrack: "Pick a track first.",
    quotaGone:
      "You've used today's 20 free questions.\n\nUpgrade to Pro for unlimited practice until exam season ends.",
    noQuestions: "No published questions for this subject yet.",
    notProMistakes:
      "Mistake Bank drills are a Pro feature.{count}\n\nUpgrade to retry the questions you miss.",
    noMistakes: "No unmastered mistakes in this subject. Nice work.",
    activeSession: "You already have a {mode} in progress.",
    continueSession: "▶️ Continue",
    startNew: "🆕 Start new",
    cancelled: "Quiz cancelled.",
    noActive: "No quiz in progress.",
    qProgress: "Question {n}/{total}",
    skip: "⏭ Skip",
    end: "🚪 End",
    next: "Next ➡️",
    seeResults: "See results",
    correct: "✅ Correct",
    wrong: "❌ Wrong — answer is {key}",
    another10: "⚡ Another 10",
    anotherMock: "📝 Another full exam",
    mainMenu: "🏠 Menu",
    backToMenu: "🏠 Back to menu",
    scoreTitle: "{mode} complete",
    scoreBody:
      "Score <b>{score}/{total}</b> · +{xp} XP · streak {streak}\n{quota}",
    quotaLeft: "Free questions left today: {n}",
    quotaPro: "Pro — unlimited questions today.",
    emptyQuiz: "No answers recorded. Start again when you're ready.",
    mockPick: "Choose a paper. Chat sittings are untimed with instant feedback.",
    sourcePick: "Where should the questions come from?",
    sourceMock: "Mock exam",
    sourcePast: "Past exams",
    sourceAll: "All random",
    pastPick: "Pick a past exam year.",
    sourceMockEmpty: "No mock exam questions for this subject yet.",
    sourcePastEmpty: "No past exams for this subject yet.",
    dailyPick: "Pick a paper for today's goal — {n} questions.",
    mockCapped: "Free plan: this sitting is capped at {n} questions today. Pro unlocks the full paper.",
    statsBody:
      "<b>{name}</b>\n" +
      "Track: {track}\n" +
      "XP: <b>{xp}</b> · Streak: <b>{streak}</b> days\n" +
      "{quota}\n" +
      "{last}",
    lastScore: "Last sitting: {score}/{total} ({percent}%)",
    noLast: "No sittings yet.",
    noTrackStats: "Set a track in /settings to see ranks.",
    ranksTitle: "<b>{track}</b> — top 10",
    ranksEmpty: "No one on this board yet. Be first.",
    yourRank: "Your rank: #{rank} of {total}",
    settingsTitle: "⚙️ Settings",
    settingsBody:
      "Language: <b>{lang}</b>\nTrack: <b>{track}</b>\nDaily goal: <b>{goal} Q</b>\n\nTheme and accent are in the study app.",
    changeGoal: "🎯 Daily goal",
    goalPick: "How many questions do you want each day?",
    goalSaved: "Daily goal set to {n} questions.",
    howItWorksBtn: "💡 How it works",
    supportBtn: "💬 Support",
    howItWorksTitle: "🚀 HOW IT WORKS",
    howItWorksBody:
      "1️⃣ <b>Choose Your Track</b>\n" +
      "Select your track when you get started, then pick subjects and start practising matric questions. 🎓\n" +
      "⭐ Pro users can change their track anytime.\n\n" +
      "2️⃣ <b>Practice or Take an Exam</b>\n" +
      "🧠 Quiz: Challenge yourself with a quick set of 10 questions.\n" +
      "📝 Full exam: Sit a longer paper and test your preparation.\n\n" +
      "3️⃣ <b>Use the App &amp; Compete</b>\n" +
      "📱 Open the app to access Timed Exams, Question History, Leaderboards, Duel with Friends, Notes, and more.\n\n" +
      "4️⃣ <b>Earn XP &amp; Build Your Streak</b>\n" +
      "🔥 Practice every day, earn XP, maintain your streak, and keep improving your performance.\n\n" +
      "5️⃣ <b>Learn From Your Mistakes</b>\n" +
      "❌ Get questions wrong? No problem. Your Mistake Bank helps you review the questions you struggled with and turn mistakes into progress. 💪\n\n" +
      "6️⃣ <b>Free vs Pro</b>\n" +
      "🆓 Free: Up to 20 questions per day with access to core features.\n" +
      "💎 Pro: Unlimited practice, Mistake Bank, all tracks, and the full Pro experience.\n\n" +
      "🏆 Study. Compete. Improve. Ace Your Matric Exam. 🎯",
    supportTitle: "🛠️ NEED HELP? WE’VE GOT YOU!",
    supportBody:
      "Having an issue with Pro, payments, your account, or the app? ⭐️📱\n" +
      "Found a bug or something that doesn’t look right? 🐛\n\n" +
      "💬 Message our support team on Telegram using the button below.",
    openSupport: "💬 Message on Telegram",
    langEn: "🇬🇧 English",
    langAm: "🇪🇹 አማርኛ",
    changeLang: "🌐 Language",
    changeTrack: "🧭 Track",
    changeSubject: "📚 Subject",
    saved: "Saved.",
    proTitle: "⭐ Matric Prep Pro",
    proBody:
      "<b>{price} ETB</b> until {date}\n\n• All tracks\n• Unlimited questions & full exams\n• Mistake Bank drills\n• Duel rooms in the app (2–10 players)\n\n{pay}",
    proActive: "Pro is already active until {date}.",
    proPending: "We have your payment. Waiting for admin review.",
    proRejected: "Last request was rejected{reason}. You can send a new receipt.",
    ivePaid: "✅ I've paid",
    proCancel: "✖️ Cancel",
    proCancelled: "Okay — Pro upgrade cancelled. Use the menu whenever you want.",
    sendPhoto: "Send a photo of your payment receipt here.",
    sendPhotoNeed: "Please send a photo of the receipt (not a file).",
    proSubmitted: "Receipt received. We'll message you when Pro is approved.",
    proTooBig: "That photo is too large (max 5 MB). Try a screenshot, or upload in the app.",
    proUploadFailed: "We couldn't receive that photo. Please try again or upload in the app.",
    moreTitle: "⚙️ More",
    morePrompt: "Pick an option below.",
    page: "Page {n}",
    prev: "⬅️ Prev",
    nextPage: "Next ➡️",
    expired: "That quiz expired. Start a new one.",
    stale: "That button is out of date. Use /menu.",
    modeQuick: "Quick 10",
    modeMock: "Full exam",
    modeDaily: "Daily goal",
    modeMistakes: "Mistake drill",
    dailyPush:
      "🎯 <b>Daily goal</b>\n\nTime for today's sitting. Pick a paper and do your daily question goal in chat.",
    answerDaily: "🎯 Start daily goal",
    streakPush:
      "🔥 <b>Streak saver</b>\n\n{name}, your <b>{n}-day streak</b> resets at midnight if you don't practice today.",
    saveStreak: "🔥 Save my streak",
    proApproved: "⭐ Pro is active until {date}. Unlimited practice is unlocked.",
    proDenied: "Your Pro request was not approved{reason}. Send a new receipt with /pro.",
    unknown: "I didn't catch that. Use the keyboard or /help.",
    serviceUnavailable:
      "The app backend is temporarily offline. Please try again later or contact support if this keeps happening.",
    groupStart:
      "👋 <b>Matric Prep</b> — practice for the Ethiopian matric exam.\n\n" +
      "<b>In private chat</b> (message me directly):\n" +
      "• ⚡ Quizzes and 📝 full exams\n" +
      "• 🎯 Daily goals, stats, streaks, ranks\n" +
      "• 🧠 Mistake bank (Pro)\n\n" +
      "<b>In groups</b> — ⚔️ duel races:\n" +
      "Everyone answers the same questions. <b>First correct answer scores.</b> " +
      "A wrong answer sits you out for that question. Most points when the paper ends wins.\n\n" +
      "Tap a button below. To start a duel, send /duel.",
    groupStartDuel: "⚔️ Start a duel",
    groupHelp:
      "<b>Groups</b>\n" +
      "/start — what this bot does\n" +
      "/duel — start a duel race in this group\n\n" +
      "Quizzes, exams and stats — open the bot in private chat.",
    groupUsePrivate:
      "Practice and quizzes work in <b>private chat</b>, not in the group.\n\n" +
      "In this group you can run /duel.\n\n" +
      '👉 <a href="{dmLink}">Message me privately</a> to start.',
    groupOpenPrivate: "📱 Open private chat",
    groupCallbackAlert: "Open the bot in private chat to use this button.",
    groupDuelMenu:
      "⚔️ <b>Duel</b>\n\n" +
      "Same questions for everyone in the group.\n" +
      "• The <b>first correct tap scores</b> the point.\n" +
      "• A wrong tap sits you out for that question.\n" +
      "• Most points when the paper ends wins.\n\n" +
      "Choose where to play:",
    groupDuelInApp: "📱 In the app",
    groupDuelInChat: "💬 In this chat",
    groupDuelPickSubject: "⚔️ <b>New duel</b> · 1/3\n\nPick the subject:",
    groupDuelPickQuestions: "⚔️ <b>New duel</b> · 2/3\n{subject}\n\nHow many questions?",
    groupDuelPickPlayers:
      "⚔️ <b>New duel</b> · 3/3\n{subject} · {count} questions\n\nMax players?",
    groupDuelConfirm:
      "⚔️ <b>Ready to create</b>\n{subject} · {count} questions · up to {players} players\n\nCreate the lobby?",
    groupDuelCreate: "✅ Create lobby",
    groupDuelBack: "⬅️ Back",
    groupDuelCancel: "✖️ Cancel",
    groupDuelNotYours: "Only the host can set up this duel. Send /duel to start your own.",
    groupDuelExpired: "That setup expired. Send /duel to start again.",
    groupDuelNoQuestions: "No published questions for this subject yet.",
    groupDuelNotEnough: "Not enough questions for this subject yet.",
    groupDuelCreateFailed: "Could not create the duel. Try again.",
    groupDuelLobby:
      "⚔️ <b>Duel lobby</b> · <code>{code}</code>\n" +
      "{subject} · {count} questions · {filled}/{max} players\n\n" +
      "<b>Players</b>\n{roster}\n\n" +
      "<b>How to play</b>\n" +
      "1. Tap <b>+ Join</b> to take a seat.\n" +
      "2. The host taps <b>▶ Start</b> when everyone is in.\n" +
      "3. First correct answer scores — most points wins.",
    groupDuelEmptyRoster: "No players yet.",
    groupDuelJoin: "+ Join",
    groupDuelStart: "▶ Start",
    groupDuelFull: "This duel is full.",
    groupDuelNeedPlayers: "Need at least 2 players to start.",
    groupDuelAlreadyStarted: "That duel already started.",
    groupDuelHostStartOnly: "Only the host can start.",
    groupDuelJoinFirst: "Tap + Join first.",
    groupDuelJoined: "You joined! Wait for the host to start.",
    groupDuelQuestion: "⚔️ <b>Question {n}/{total}</b> · {subject}",
    groupDuelScores: "Score: {scores}",
    groupDuelCorrect: "✅ <b>{name}</b> got it! Answer: <b>{key}</b>",
    groupDuelAnswerIs: "✅ Correct answer: <b>{key}</b>",
    groupDuelWrongTap: "❌ Wrong — you're out for this question.",
    groupDuelLocked: "You already answered this question.",
    groupDuelTooLate: "Too late — someone already scored.",
    groupDuelExplain: "💡 {text}",
    groupDuelReveal: "⏭ Reveal",
    groupDuelNext: "Next ▶",
    groupDuelSeeResults: "🏁 See results",
    groupDuelResults: "🏁 <b>Duel complete</b> · <code>{code}</code>\n\n{ranking}",
    groupDuelWinner: "🥇 Winner: <b>{name}</b>",
    groupDuelDraw: "🤝 It's a draw!",
    groupDuelNewDuel: "⚔️ New duel",
    duelPlayInApp: "📱 Play in app",
    studentFallback: "Student",
    xpUnit: "XP",
    langNameEn: "English",
    langNameAm: "አማርኛ",
    questionUnit: "Q",
    duelJoinFailed: "Could not join the duel. Please try again.",
    giftAccept:
      "A friend sent you MatricPrep Pro.\n\nCode <b>{code}</b>\nOpen the app to redeem.",
    giftRedeem: "REDEEM GIFT",
    cmdGroupStart: "What this bot does",
    cmdGroupDuel: "Start a duel race in this group",
    cmdGroupHelp: "Group help",
    cmdStart: "Main menu",
    cmdQuiz: "Quick 10 in chat",
    cmdExam: "Full exam in chat",
    cmdDaily: "Daily goal sitting",
    cmdMistakes: "Mistake drill (Pro)",
    cmdStats: "XP, streak, quota",
    cmdRanks: "Track leaderboard",
    cmdSettings: "Language, track, daily goal",
    cmdHow: "How it works",
    cmdSupport: "Help & contact",
    cmdPro: "Upgrade to Pro",
    cmdDuel: "Duel room (opens app)",
    cmdHistory: "Attempt history (opens app)",
    cmdCancel: "Stop the current quiz",
    cmdHelp: "Command list",
    cmdMenu: "Show the menu",
  },
  am: {
    quiz: "⚡ ፈጣን 10",
    mock: "📝 ሙሉ ፈተና",
    daily: "🎯 ዛሬ",
    stats: "📊 ውጤቴ",
    ranks: "🏆 ደረጃ",
    more: "⚙️ ሌሎች",
    mistakes: "🧠 ተሳሳቱ",
    pro: "⭐ ፕሮ",
    menuDuel: "⚔️ ዱኤል",
    menuTracks: "🧭 መንገድ",
    menuHistory: "📖 ታሪክ",
    menuSettings: "⚙️ ቅንብሮች",
    menuHow: "💡 እንዴት",
    menuSupport: "💬 እገዛ",
    welcome:
      "ሰላም{name}! 12ኛ ክፍል ፈተናን እዚህ በቻት ይለማመዱ።\n\nከታች ያለውን ይጫኑ ወይም /help ይጻፉ።",
    onboardLang: "ቋንቋዎን ይምረጡ",
    onboardTrack:
      "ትምህርት መንገድዎን ይምረጡ።\n\n⚠️ በጥንቃቄ ይምረጡ። ከተዘጋጁ በኋላ መንገድ መቀየር የሚችሉት ፕሮ ካሎት ብቻ ነው።",
    trackLocked: "በነፃ እቅድ ክፍሉ ተቆልፏል። ለመቀየር ወደ ፕሮ ያሻሽሉ።",
    changeTrackPro: "⭐ በፕሮ ቀይር",
    onboardDone: "ተዘጋጅተዋል። መንገድ: <b>{track}</b>።",
    onboardSubject:
      "አሁን ጉዳዎችዎን ይምረጡ።\n\nበዚህ ጊዜ ከቅንብሮች ሌሎችንም ማካተን ይችላሉ።",
    onboardSubjectDone:
      "ሁሉም ተዘጋጅተዋል። <b>{track}</b> · <b>{subject}</b> የመጀመሪያዎ ጉዳ ነው።\n\nከታች ያለውን ይጫኑ።",
    pickSubject: "የትኛው ጉዳ?",
    needSubject: "በመጀመሪያ ጉዳ ይምረጡ።",
    menuTitle: "ምን ማድረግ ይፈልጋሉ?",
    help:
      "<b>ትዕዛዞች</b>\n" +
      "/quiz — ፈጣን 10 በቻት\n" +
      "/exam — ሙሉ ፈተና በቻት\n" +
      "/daily — የዕለት ግብ ልምምድ\n" +
      "/mistakes — የስህተት ልምምድ (ፕሮ)\n" +
      "/stats — ነጥብ፣ ተከታታይ፣ ጥቅም\n" +
      "/ranks — የክፍል ደረጃ\n" +
      "/settings — ቋንቋ፣ ክፍል እና የዕለት ግብ\n" +
      "/how — እንዴት ይሰራል?\n" +
      "/support — እገዛ\n" +
      "/pro — ማሻሻል\n" +
      "/duel — ዱኤል (መተግበሪያ)\n" +
      "/history — ታሪክ (መተግበሪያ)\n" +
      "/cancel — የአሁኑን ፈተና አቁም\n" +
      "/menu — ሜኑ አሳይ",
    openApp: "📱 መተግበሪያ",
    trackedLinkInvite: "እንኳን ደህና መጡ! ለመጀመር ከታች ይንኩ።",
    openLink: "🔗 አገናኝ ክፈት",
    openTimedQuiz: "⏱ የተወሰነ ጊዜ ፈጣን 10",
    openTimedMock: "⏱ የተወሰነ ጊዜ ሙሉ ፈተና",
    openMistakes: "🧠 የስህተት ባንክ",
    openDuel: "⚔️ በቦት ይቀላቀሉ",
    openHistory: "📖 መዝገብ",
    openReview: "📖 ግምገማ",
    openTheme: "🎨 ገጽታ",
    openPro: "📱 በመተግበሪያ ላክ",
    openRanks: "🏆 ደረጃ ሰሌዳ",
    duelPitch:
      "ዱኤል የጋራ ወረቀት እና ሰዓት ይጠቀማል። 2–10 ተጫዋቾች። በመተግበሪያው ውስጥ ነው።\n\nየጥያቄ ምንጩን ይምረጡ፣ ከዚያ ሎቢውን ይክፈቱ።",
    duelAccept:
      "ወደ የመውጫ ፈተና ዱኤል ተጋብዘዋል።\n\nኮድ: <b>{code}</b>\n\nለመቀላቀል ከታች ይጫኑ፣ ከዚያ በመተግበሪያ ይጫወቱ።",
    historyPitch: "የፈተና ታሪክ እና የጥያቄ ግምገማ በመተግበሪያው ውስጥ ነው።",
    needTrack: "መጀመሪያ ክፍል ይምረጡ።",
    quotaGone:
      "የዛሬውን 20 ነፃ ጥያቄ ተጠቅመዋል።\n\nእስከ የፈተና ወቅት መጨረሻ ያልተገደበ ልምምድ ለፕሮ ያሻሽሉ።",
    noQuestions: "ለዚህ ክፍል እስካሁን የታተመ ጥያቄ የለም።",
    notProMistakes:
      "የስህተት ባንክ ልምምድ የፕሮ ባህሪ ነው።{count}\n\nያመለጡትን ጥያቄዎች ለመድገም ያሻሽሉ።",
    noMistakes: "በዚህ ክፍል ያልተወጡ ስህተቶች የሉም። ጥሩ!",
    activeSession: "አሁን የ{mode} ልምምድ በሂደት ላይ ነው።",
    continueSession: "▶️ ቀጥል",
    startNew: "🆕 አዲስ",
    cancelled: "ፈተናው ተሰርዟል።",
    noActive: "በሂደት ላይ ያለ ፈተና የለም።",
    qProgress: "ጥያቄ {n}/{total}",
    skip: "⏭ ጥለው",
    end: "🚪 አቁም",
    next: "ቀጣይ ➡️",
    seeResults: "ውጤት ይመልከቱ",
    correct: "✅ ትክክል",
    wrong: "❌ ስህተት — መልሱ {key} ነው",
    another10: "⚡ ሌላ 10",
    anotherMock: "📝 ሌላ ሙሉ ፈተና",
    mainMenu: "🏠 መነሻ",
    backToMenu: "🏠 ወደ ዋና ሜኑ",
    scoreTitle: "{mode} ተጠናቋል",
    scoreBody:
      "ውጤት <b>{score}/{total}</b> · +{xp} ነጥብ · ተከታታይ {streak}\n{quota}",
    quotaLeft: "ዛሬ የቀሩ ነፃ ጥያቄዎች: {n}",
    quotaPro: "ፕሮ — ዛሬ ያልተገደበ።",
    emptyQuiz: "ምንም መልስ አልተመዘገበም። ሲዘጋጁ እንደገና ይጀምሩ።",
    mockPick: "ፈተና ይምረጡ። በቻት ሰዓት የለውም፣ መልሱ ወዲያው ይታያል።",
    sourcePick: "ጥያቄዎቹ ከየት ይምጡ?",
    sourceMock: "ሞዴል ፈተና",
    sourcePast: "ያለፉ ፈተናዎች",
    sourceAll: "ሁሉ በዘፈቀደ",
    pastPick: "የመውጫ ፈተና ዓመት ይምረጡ።",
    sourceMockEmpty: "ለዚህ ክፍል ሞክ ፈተና ጥያቄ የለም።",
    sourcePastEmpty: "ለዚህ ክፍል ያለፈ ፈተና የለም።",
    dailyPick: "የዛሬው ግብ — {n} ጥያቄ። ወረቀት ይምረጡ።",
    mockCapped: "ነፃ እቅድ: ይህ ልምምድ ዛሬ በ {n} ጥያቄ ይቆማል። ፕሮ ሙሉውን ወረቀት ይከፍታል።",
    statsBody:
      "<b>{name}</b>\n" +
      "መንገድ: {track}\n" +
      "ነጥብ: <b>{xp}</b> · ተከታታይ: <b>{streak}</b> ቀናት\n" +
      "{quota}\n" +
      "{last}",
    lastScore: "መጨረሻ: {score}/{total} ({percent}%)",
    noLast: "እስካሁን ፈተና የለም።",
    noTrackStats: "ደረጃ ለማየት በ /settings ክፍል ያስቀምጡ።",
    ranksTitle: "<b>{track}</b> — ከፍተኛ 10",
    ranksEmpty: "በዚህ ሰሌዳ ማንም የለም። የመጀመሪያ ይሁኑ።",
    yourRank: "ደረጃዎ: #{rank} ከ {total}",
    settingsTitle: "⚙️ ቅንብሮች",
    settingsBody:
      "ቋንቋ: <b>{lang}</b>\nመንገድ: <b>{track}</b>\nየዕለት ግብ: <b>{goal} ጥያቄ</b>\n\nገጽታ፣ ቀለም እና ሁለት ቋንቋ በመተግበሪያው ውስጥ ናቸው።",
    changeGoal: "🎯 የዕለት ግብ",
    goalPick: "በቀን ስንት ጥያቄ ይፈልጋሉ?",
    goalSaved: "የዕለት ግብ {n} ጥያቄ ሆኗል።",
    howItWorksBtn: "💡 እንዴት ይሰራል?",
    supportBtn: "💬 እገዛ",
    howItWorksTitle: "እንዴት ይሰራል?",
    howItWorksBody:
      "1. መጀመሪያ ክፍልዎን ይምረጡ (ፕሮ በማንኛውም ጊዜ መቀየር ይችላሉ)።\n" +
      "2. <b>Quiz</b> — ፈጣን 10 በቻት። <b>Full exam</b> — ሙሉ ፈተና በቻት።\n" +
      "3. መተግበሪያውን ለ timed ፈተና፣ ታሪክ፣ ደረጃ እና ዱኤል ክፈቱ።\n" +
      "4. በየቀኑ በመለማመድ XP እና ተከታታይ ይገኙ።\n" +
      "5. ነፃ፡ ቀን 20 ጥያቄ። ፕሮ፡ ያልተገደበ ልምምድ፣ የስህተት ባንክ፣ ሁሉም ክፍሎች።",
    supportTitle: "እገዛ",
    supportBody:
      "ስለ ፕሮ፣ ክፍያ ወይም ችግር ይረዳዎታል?\n\nከታች ያለውን ቁልፍ በመጫን በቴሌግራም ይጻፉልን። በተቻለ ፍጥነት እንመልሳለን።",
    openSupport: "💬 በቴሌግራም ይጻፉ",
    langEn: "🇬🇧 English",
    langAm: "🇪🇹 አማርኛ",
    changeLang: "🌐 ቋንቋ",
    changeTrack: "🧭 መንገድ",
    changeSubject: "📚 ጉዳ",
    saved: "ተቀምጧል።",
    proTitle: "⭐ የመውጫ ፈተና ፕሮ",
    proBody:
      "<b>{price} ብር</b> እስከ {date}\n\n• ሁሉም ክፍሎች\n• ያልተገደበ ጥያቄ እና የመውጫ ፈተና\n• የስህተት ባንክ\n• ዱኤል በመተግበሪያ (2–10 ተጫዋቾች)\n\n{pay}",
    proActive: "ፕሮ እስከ {date} ንቁ ነው።",
    proPending: "ክፍያዎ ደርሷል። የአስተዳዳሪ ግምገማ በመጠባበቅ ላይ።",
    proRejected: "የመጨረሻው ጥያቄ ውድቅ ሆነ{reason}። አዲስ ደረሰኝ መላክ ይችላሉ።",
    ivePaid: "✅ ከፍያለሁ",
    proCancel: "✖️ ሰርዝ",
    proCancelled: "እሺ — የፕሮ ማሻሻያ ተሰርዟል። ሜኑውን በማንኛውም ጊዜ ይጠቀሙ።",
    sendPhoto: "የክፍያ ደረሰኝ ፎቶ እዚህ ይላኩ።",
    sendPhotoNeed: "እባክዎ የደረሰኝ ፎቶ ይላኩ (ፋይል አይደለም)።",
    proSubmitted: "ደረሰኝ ደርሷል። ፕሮ ሲፀድቅ እንልክልዎታለን።",
    proTooBig: "ፎቶው በጣም ትልቅ ነው (ከፍተኛ 5ሜባ)። ስክሪንሾት ይሞክሩ ወይም በመተግበሪያው ይላኩ።",
    proUploadFailed: "ያን ፎቶ መቀበል አልቻልንም። እንደገና ይሞክሩ ወይም በመተግበሪያው ይላኩ።",
    moreTitle: "⚙️ ተጨማሪ",
    morePrompt: "ከታች አንዱን ይምረጡ።",
    page: "ገጽ {n}",
    prev: "⬅️ ቀዳሚ",
    nextPage: "ቀጣይ ➡️",
    expired: "ያ ፈተና ጊዜው አልፏል። አዲስ ይጀምሩ።",
    stale: "ያ ቁልፍ አልተዘመነም። /menu ይጠቀሙ።",
    modeQuick: "ፈጣን 10",
    modeMock: "ሙሉ ፈተና",
    modeDaily: "የዕለት ግብ",
    modeMistakes: "ተሳሳቱ ጥያቄ",
    dailyPush:
      "🎯 <b>የዕለት ግብ</b>\n\nየዛሬውን ግብ በቻት ለመስራት ወረቀት ይምረጡ።",
    streakPush:
      "🔥 <b>ተከታታይ አድን</b>\n\n{name}፣ የ<b>{n} ቀን ተከታታይዎ</b> ዛሬ ካልተለማመዱ በእኩለ ሌሊት ይጀምራል።",
    saveStreak: "🔥 ተከታታዬን አድን",
    answerDaily: "🎯 የዕለት ግብ ጀምር",
    proApproved: "⭐ ፕሮ እስከ {date} ንቁ ነው። ያልተገደበ ልምምድ ተከፍቷል።",
    proDenied: "የፕሮ ጥያቄዎ አልጸደቀም{reason}። በ /pro አዲስ ደረሰኝ ይላኩ።",
    unknown: "አልገባኝም። ሜኑውን ወይም /help ይጠቀሙ።",
    serviceUnavailable:
      "የመተግበሪያው አገልግሎት ለጊዜው አልተገኘም። ቆይተው እንደገና ይሞክሩ ወይም ችግሩ ከቀጠለ እገዛን ይጻፉ።",
    groupStart:
      "👋 <b>Exit Plan</b> — ለኢትዮጵያ መውጫ ፈተና ልምምድ።\n\n" +
      "<b>በግል ቻት</b> (በቀጥታ ይጻፉልኝ):\n" +
      "• ⚡ ፈጣን ፈተና እና 📝 ሙሉ ፈተና\n" +
      "• 🎯 የዕለት ግብ፣ ውጤት፣ ተከታታይ፣ ደረጃ\n" +
      "• 🧠 የስህተት ባንክ (ፕሮ)\n\n" +
      "<b>በቡድን</b> — ⚔️ የዱኤል ውድድር፦\n" +
      "ሁሉም አንድ አይነት ጥያቄዎችን ይመልሳል። <b>በመጀመሪያ ትክክለኛውን የመረጠ ነጥብ ያገኛል።</b> " +
      "ስህተት መልሶ ለዚያ ጥያቄ ይቆማል። በመጨረሻ ብዙ ነጥብ ያለው ያሸንፋል።\n\n" +
      "ከታች አንዱን ይጫኑ። ዱኤል ለመጀመር /duel ይላኩ።",
    groupStartDuel: "⚔️ ዱኤል ጀምር",
    groupHelp:
      "<b>ቡድን</b>\n" +
      "/start — ይህ ቦት ምን እንደሚሰራ\n" +
      "/duel — በዚህ ቡድን የዱኤል ውድድር ጀምር\n\n" +
      "ፈተናዎች፣ ልምምድ እና ውጤት — በግል ቻት።",
    groupUsePrivate:
      "ልምምድ በ<b>ግል ቻት</b> ብቻ ነው።\n\n" +
      "በቡድን /duel ማስኬድ ይችላሉ።\n\n" +
      '👉 <a href="{dmLink}">ግል ቻት ይክፈቱ</a>።',
    groupOpenPrivate: "📱 ግል ቻት",
    groupCallbackAlert: "ይህን ቁልፍ በግል ቻት ይጠቀሙ።",
    groupDuelMenu:
      "⚔️ <b>ዱኤል</b>\n\n" +
      "በቡድኑ ውስጥ ሁሉም ተመሳሳይ ጥያቄዎች።\n" +
      "• <b>በመጀመሪያ ትክክለኛ የመረጠ ነጥብ ያገኛል።</b>\n" +
      "• ስህተት መልሶ ለዚያ ጥያቄ ይቆማል።\n" +
      "• ብዙ ነጥብ ያለው ያሸንፋል።\n\n" +
      "የት መጫወት ይፈልጋሉ?",
    groupDuelInApp: "📱 በመተግበሪያ",
    groupDuelInChat: "💬 በዚህ ቻት",
    groupDuelPickSubject: "⚔️ <b>አዲስ ዱኤል</b> · 1/3\n\nርህቅ ይምረጡ:",
    groupDuelPickQuestions: "⚔️ <b>አዲስ ዱኤል</b> · 2/3\n{subject}\n\nስንት ጥያቄ?",
    groupDuelPickPlayers:
      "⚔️ <b>አዲስ ዱኤል</b> · 3/3\n{subject} · {count} ጥያቄ\n\nከፍተኛ ተጫዋቾች?",
    groupDuelConfirm:
      "⚔️ <b>ለመፍጠር ዝግጁ</b>\n{subject} · {count} ጥያቄ · እስከ {players} ተጫዋቾች\n\nሎቢ ይፈጠር?",
    groupDuelCreate: "✅ ሎቢ ፍጠር",
    groupDuelBack: "⬅️ ተመለስ",
    groupDuelCancel: "✖️ ሰርዝ",
    groupDuelNotYours: "ሎቢውን ማዘጋጀት የሚችለው አስተናጋጁ ብቻ ነው። የራስዎን ለመጀመር /duel ይላኩ።",
    groupDuelExpired: "ያ ማዋቀር ጊዜው አልፏል። /duel እንደገና ይላኩ።",
    groupDuelNoQuestions: "ለዚህ ርህቅ እስካሁን የታተመ ጥያቄ የለም።",
    groupDuelNotEnough: "ለዚህ ርህቅ በቂ ጥያቄ የለም።",
    groupDuelCreateFailed: "ዱኤሉን መፍጠር አልተቻለም። እንደገና ይሞክሩ።",
    groupDuelLobby:
      "⚔️ <b>የዱኤል ሎቢ</b> · <code>{code}</code>\n" +
      "{subject} · {count} ጥያቄ · {filled}/{max} ተጫዋቾች\n\n" +
      "<b>ተጫዋቾች</b>\n{roster}\n\n" +
      "<b>እንዴት ይጫወታሉ</b>\n" +
      "1. <b>+ Join</b> ይጫኑ እና ቦታ ይያዙ።\n" +
      "2. ሁሉም ሲገባ አስተናጋጁ <b>▶ Start</b> ይጫናል።\n" +
      "3. በመጀመሪያ ትክክለኛ የመረጠ ነጥብ ያገኛል — ብዙ ነጥብ ያለው ያሸንፋል።",
    groupDuelEmptyRoster: "እስካሁን ተጫዋች የለም።",
    groupDuelJoin: "+ Join",
    groupDuelStart: "▶ ጀምር",
    groupDuelFull: "ይህ ዱኤል ሙሉ ነው።",
    groupDuelNeedPlayers: "ለመጀመር ቢያንስ 2 ተጫዋቾች ያስፈልጋሉ።",
    groupDuelAlreadyStarted: "ያ ዱኤል አስቀድሞ ተጀምሯል።",
    groupDuelHostStartOnly: "ማስጀመር የሚችለው አስተናጋጁ ብቻ ነው።",
    groupDuelJoinFirst: "መጀመሪያ + Join ይጫኑ።",
    groupDuelJoined: "ተቀላቅለዋል! አስተናጋጁ እስኪጀምር ይጠብቁ።",
    groupDuelQuestion: "⚔️ <b>ጥያቄ {n}/{total}</b> · {subject}",
    groupDuelScores: "ነጥብ: {scores}",
    groupDuelCorrect: "✅ <b>{name}</b> መልሶታል! መልሱ: <b>{key}</b>",
    groupDuelAnswerIs: "✅ ትክክለኛ መልስ: <b>{key}</b>",
    groupDuelWrongTap: "❌ ስህተት — ለዚህ ጥያቄ ወጥተዋል።",
    groupDuelLocked: "ለዚህ ጥያቄ አስቀድመው መልሰዋል።",
    groupDuelTooLate: "ዘግይቷል — ሌላ ሰው አስቀድሞ ነጥብ አግኝቷል።",
    groupDuelExplain: "💡 {text}",
    groupDuelReveal: "⏭ መልሱን አሳይ",
    groupDuelNext: "ቀጣይ ▶",
    groupDuelSeeResults: "🏁 ውጤት ይመልከቱ",
    groupDuelResults: "🏁 <b>ዱኤል ተጠናቋል</b> · <code>{code}</code>\n\n{ranking}",
    groupDuelWinner: "🥇 አሸናፊ: <b>{name}</b>",
    groupDuelDraw: "🤝 አቻ ውጤት!",
    groupDuelNewDuel: "⚔️ አዲስ ዱኤል",
    duelPlayInApp: "📱 በመተግበሪያ ይጫወቱ",
    studentFallback: "ተማሪ",
    xpUnit: "ነጥብ",
    langNameEn: "እንግሊዝኛ",
    langNameAm: "አማርኛ",
    questionUnit: "ጥያቄ",
    duelJoinFailed: "ዱኤሉን መቀላቀል አልተቻለም። እንደገና ይሞክሩ።",
    giftAccept:
      "አንድ ጓደኛዎ የመውጫ ፈተና ፕሮ ላከልዎት።\n\nኮድ <b>{code}</b>\nለመቀበል መተግበሪያውን ይክፈቱ።",
    giftRedeem: "ስጦታ ተቀበል",
    cmdGroupStart: "ይህ ቦት ምን ያደርጋል",
    cmdGroupDuel: "በዚህ ቡድን ዱኤል ጀምር",
    cmdGroupHelp: "የቡድን እገዛ",
    cmdStart: "ዋና ሜኑ",
    cmdQuiz: "ፈጣን 10 በቻት",
    cmdExam: "ሙሉ ፈተና በቻት",
    cmdDaily: "የዕለት ግብ ልምምድ",
    cmdMistakes: "የስህተት ልምምድ (ፕሮ)",
    cmdStats: "ነጥብ፣ ተከታታይ፣ ጥቅም",
    cmdRanks: "የክፍል ደረጃ",
    cmdSettings: "ቋንቋ፣ ክፍል እና የዕለት ግብ",
    cmdHow: "እንዴት እንደሚሰራ",
    cmdSupport: "ድጋፍ",
    cmdPro: "ወደ ፕሮ አሻሽል",
    cmdDuel: "ዱኤል (መተግበሪያ)",
    cmdHistory: "ታሪክ (መተግበሪያ)",
    cmdCancel: "ፈተና አቁም",
    cmdHelp: "ትዕዛዞች",
    cmdMenu: "ሜኑ አሳይ",
  },
} as const;

export type BotCopy = (typeof botCopy)[Lang];

export { t } from "./translate";

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function modeLabel(lang: Lang, mode: SessionMode): string {
  const c = botCopy[lang];
  if (mode === "quick") return c.modeQuick;
  if (mode === "mock") return c.modeMock;
  if (mode === "daily") return c.modeDaily;
  return c.modeMistakes;
}

export type KeyboardAction = MainMenuAction | "more";

const ACTION_LABEL_KEYS: Record<MainMenuAction, Array<keyof BotCopy>> = {
  quiz: ["quiz"],
  mock: ["mock"],
  daily: ["daily"],
  mistakes: ["mistakes"],
  stats: ["stats"],
  ranks: ["ranks"],
  duel: ["menuDuel", "openDuel"],
  tracks: ["menuTracks", "changeTrack"],
  history: ["menuHistory", "openHistory"],
  settings: ["menuSettings", "settingsTitle"],
  pro: ["pro"],
  how: ["menuHow", "howItWorksBtn"],
  support: ["menuSupport", "supportBtn"],
};

const LEGACY_KEYBOARD: Record<KeyboardAction, string[]> = {
  quiz: [
    "⚡ Quiz",
    "→ Quick 10",
    "→ ፈጣን 10",
    "⚡ ፈጣን 10",
    "⚡ Quick 10",
  ],
  mock: [
    "📝 Full exam",
    "Full exam",
    "📝 Past paper",
    "📝 መውጫ ፈተና",
    "⇒ Past paper",
    "⇒ መውጫ ፈተና",
    "📝 Exam",
    "📝 Mock",
    "📝 ሙሉ ፈተና",
    "📝 ሞክ",
  ],
  daily: ["🎯 Daily", "🎯 ዛሬ", "↻ Daily", "↻ ዛሬ"],
  stats: ["📊 Stats", "📊 ውጤቴ", "▤ Stats", "▤ ውጤቴ"],
  ranks: ["🏆 Ranks", "🏆 ደረጃ", "↑ Ranks", "↑ ደረጃ"],
  more: ["⚙️ More", "⚙️ ሌሎች", "⋯ More", "⋯ ሌሎች"],
  mistakes: ["🧠 Mistakes", "🧠 ተሳሳቱ"],
  duel: ["⚔️ Duel", "⚔️ ዱኤል"],
  tracks: ["🧭 Track", "🧭 መንገድ", "🧭 Tracks", "🧭 መንገዶች"],
  history: ["📖 History", "📖 ታሪክ"],
  settings: ["⚙️ Settings", "⚙️ ቅንብሮች"],
  pro: ["⭐ Pro", "⭐ ፕሮ"],
  how: ["💡 How it works", "💡 እንዴት"],
  support: ["💬 Support", "💬 እገዛ"],
};

const PLAIN_MENU_LABELS = new Set(allMenuPlainLabels());

export function isLegacyKeyboardLabel(text: string): boolean {
  const normalized = text.trim();
  return Object.values(LEGACY_KEYBOARD).some((labels) => labels.includes(normalized));
}

/**
 * Resolves a plain-text message back to a menu action.
 *
 * `copies` must be the *merged* (translated) copies for the request, otherwise
 * labels rewritten by admins in the translations panel no longer match the text
 * the keyboard actually sent — which silently broke Amharic buttons.
 */
export function matchKeyboardAction(
  text: string,
  copies: BotCopy[] = [],
): KeyboardAction | null {
  const normalized = text.trim();
  const lower = normalized.toLocaleLowerCase();
  const sources = [...copies, botCopy.en, botCopy.am];

  for (const c of sources) {
    if (normalized === c.more) return "more";
    for (const [action, keys] of Object.entries(ACTION_LABEL_KEYS) as Array<
      [MainMenuAction, Array<keyof BotCopy>]
    >) {
      if (keys.some((key) => c[key] === normalized)) return action;
    }
  }
  if (PLAIN_MENU_LABELS.has(normalized)) {
    for (const lang of ["en", "am"] as const) {
      for (const action of Object.keys(MENU_PLAIN.en) as MainMenuAction[]) {
        if (MENU_PLAIN[lang][action] === normalized) return action;
      }
    }
  }
  for (const [action, labels] of Object.entries(LEGACY_KEYBOARD) as Array<
    [keyof typeof LEGACY_KEYBOARD, string[]]
  >) {
    if (labels.some((label) => label.toLocaleLowerCase() === lower)) return action;
  }
  return null;
}
