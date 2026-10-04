import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const themeValues = v.union(
  v.literal("midnight"),
  v.literal("crt"),
  v.literal("obsidian"),
  v.literal("paper"),
  v.literal("snow"),
  v.literal("sand"),
  v.literal("dark"),
  v.literal("light"),
  v.literal("system"),
  v.literal("telegram"),
);

export const accentValues = v.string();

export const fontSizeValues = v.union(
  v.literal("sm"),
  v.literal("md"),
  v.literal("lg"),
);

/**
 * How a sitting was produced. Only `mock` (a full paper) counts toward the
 * student's projected total; the rest are practice and never move the total.
 */
export const attemptModeValues = v.union(
  v.literal("quick"),
  v.literal("mock"),
  v.literal("practice"),
  v.literal("mistakes"),
  v.literal("daily"),
);

const optionValidator = v.object({
  key: v.string(),
  textEn: v.string(),
  textAm: v.string(),
});

export const broadcastButtonValidator = v.object({
  row: v.number(),
  labelEn: v.string(),
  labelAm: v.string(),
  action: v.union(
    v.literal("menu"),
    v.literal("url"),
    v.literal("mini_app"),
    v.literal("custom"),
  ),
  value: v.string(),
});

export const broadcastAudienceValidator = v.object({
  all: v.boolean(),
  tracks: v.array(v.string()),
  pro: v.union(v.literal("any"), v.literal("pro"), v.literal("free")),
  languages: v.array(v.union(v.literal("en"), v.literal("am"))),
  activeWithinDays: v.optional(v.number()),
  inactiveForDays: v.optional(v.number()),
  minStreak: v.optional(v.number()),
  maxStreak: v.optional(v.number()),
  telegramIds: v.array(v.string()),
});

export const broadcastScheduleKindValues = v.union(
  v.literal("now"),
  v.literal("once"),
  v.literal("recurring"),
);

export const broadcastStatusValues = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("sending"),
  v.literal("paused"),
  v.literal("sent"),
  v.literal("cancelled"),
  v.literal("failed"),
);

export default defineSchema({
  users: defineTable({
    telegramId: v.string(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    language: v.union(v.literal("am"), v.literal("en")),
    /**
     * Natural Science / Social Science. Chosen once during onboarding and
     * gates which subjects, papers and leaderboards the student sees.
     */
    trackSlug: v.optional(v.string()),
    /**
     * Subjects the student picked during onboarding, always a subset of
     * `trackSlug`. Defaults the app to their subjects instead of making them
     * re-pick on every screen.
     */
    subjectSlugs: v.optional(v.array(v.string())),
    isPro: v.boolean(),
    proExpiresAt: v.optional(v.number()),
    proApprovedAt: v.optional(v.number()),
    proApprovedBy: v.optional(v.string()),
    streakCount: v.number(),
    lastActiveAt: v.number(),
    lastPracticeAt: v.optional(v.number()),
    lastPracticeDate: v.optional(v.string()),
    dailyQuotaDate: v.optional(v.string()),
    dailyQuestionsUsed: v.optional(v.number()),
    dailyDuelsUsed: v.optional(v.number()),
    dailyUsage: v.optional(
      v.array(
        v.object({
          label: v.string(),
          questions: v.number(),
        }),
      ),
    ),
    /** Rolling window of completed full mock papers, for the monthly free cap. */
    mockAttempts: v.optional(
      v.array(
        v.object({
          month: v.string(),
          count: v.number(),
        }),
      ),
    ),
    totalDuels: v.optional(v.number()),
    biweeklyXp: v.optional(v.number()),
    biweeklyWindowStart: v.optional(v.number()),
    monthlyXp: v.optional(v.number()),
    monthlyWindowStart: v.optional(v.number()),
    xp: v.number(),
    createdAt: v.number(),
    theme: v.optional(themeValues),
    accent: v.optional(accentValues),
    fontSize: v.optional(fontSizeValues),
    hapticsEnabled: v.optional(v.boolean()),
    soundEnabled: v.optional(v.boolean()),
    dailyGoal: v.optional(v.number()),
    examYear: v.optional(v.number()),
    showBilingual: v.optional(v.boolean()),
    reduceMotion: v.optional(v.boolean()),
    instantFeedback: v.optional(v.boolean()),
    onboardingComplete: v.optional(v.boolean()),
    acquiredLinkCode: v.optional(v.string()),
    acquiredAt: v.optional(v.number()),
    isBanned: v.optional(v.boolean()),
    bannedAt: v.optional(v.number()),
    banReason: v.optional(v.string()),
  })
    .index("by_telegram_id", ["telegramId"])
    .index("by_is_pro", ["isPro"])
    .index("by_track", ["trackSlug"])
    .index("by_track_xp", ["trackSlug", "xp"])
    .index("by_track_biweekly", [
      "trackSlug",
      "biweeklyWindowStart",
      "biweeklyXp",
    ])
    .index("by_track_monthly", [
      "trackSlug",
      "monthlyWindowStart",
      "monthlyXp",
    ])
    .index("by_username", ["username"])
    .index("by_last_active", ["lastActiveAt"])
    .index("by_created", ["createdAt"]),

  premiumRequests: defineTable({
    userId: v.id("users"),
    amountEtb: v.number(),
    transactionRef: v.optional(v.string()),
    proofFileId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    kind: v.optional(v.union(v.literal("self"), v.literal("gift"))),
    giftCode: v.optional(v.string()),
    giftRecipient: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_gift_code", ["giftCode"]),

  proGifts: defineTable({
    code: v.string(),
    gifterId: v.id("users"),
    requestId: v.id("premiumRequests"),
    recipientUsername: v.optional(v.string()),
    recipientId: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("claimed"),
      v.literal("void"),
    ),
    createdAt: v.number(),
    claimedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_gifter", ["gifterId"])
    .index("by_status", ["status"]),

  /**
   * A study track. Exactly two exist (natural-science, social-science) but the
   * model does not assume that. `totalMaxMarks` is denormalised from the sum of
   * its published subjects' maxMarks so the totals screen stays one query.
   */
  tracks: defineTable({
    slug: v.string(),
    nameEn: v.string(),
    nameAm: v.string(),
    isProOnly: v.boolean(),
    isPublished: v.boolean(),
    sortOrder: v.number(),
    icon: v.optional(v.string()),
    accent: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionAm: v.optional(v.string()),
    publishedSubjectCount: v.optional(v.number()),
    publishedExamCount: v.optional(v.number()),
    totalMaxMarks: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["isPublished", "sortOrder"]),

  /**
   * An examinable subject (English, Mathematics, Physics, ...). Belongs to a
   * track. `maxMarks` is what the subject is scored out of in the national
   * total, so a track total is simply the sum of its subjects.
   */
  subjects: defineTable({
    slug: v.string(),
    trackSlug: v.string(),
    nameEn: v.string(),
    nameAm: v.string(),
    maxMarks: v.optional(v.number()),
    isProOnly: v.boolean(),
    isPublished: v.boolean(),
    sortOrder: v.number(),
    icon: v.optional(v.string()),
    accent: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionAm: v.optional(v.string()),
    publishedExamCount: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_track", ["trackSlug", "sortOrder"])
    .index("by_published", ["trackSlug", "isPublished", "sortOrder"]),

  /**
   * A paper for one subject. `trackSlug` is denormalised from the subject on
   * write so "all papers in my track" stays a single indexed query.
   * `totalMarks` is optional; when absent the sum of question marks is used.
   */
  exams: defineTable({
    subjectSlug: v.string(),
    trackSlug: v.optional(v.string()),
    year: v.number(),
    variant: v.union(v.literal("regular"), v.literal("model")),
    questionCount: v.number(),
    durationMinutes: v.number(),
    totalMarks: v.optional(v.number()),
    isPublished: v.boolean(),
    titleEn: v.optional(v.string()),
    titleAm: v.optional(v.string()),
    isProOnly: v.optional(v.boolean()),
  })
    .index("by_subject", ["subjectSlug", "year"])
    .index("by_subject_published", ["subjectSlug", "isPublished", "year"])
    .index("by_subject_variant", ["subjectSlug", "variant"])
    .index("by_subject_variant_published", [
      "subjectSlug",
      "variant",
      "isPublished",
      "year",
    ])
    .index("by_track", ["trackSlug", "isPublished", "year"]),

  questions: defineTable({
    examId: v.id("exams"),
    order: v.number(),
    /** Syllabus unit, e.g. "Algebra" for Mathematics. */
    unit: v.string(),
    /** Chapter within the unit, e.g. "Quadratic Equations". */
    chapter: v.string(),
    bloomLevel: v.optional(v.string()),
    /** Marks this question is worth. Defaults to 1 when absent. */
    marks: v.optional(v.number()),
    textEn: v.string(),
    textAm: v.string(),
    options: v.array(optionValidator),
    correctKey: v.string(),
    explanationEn: v.string(),
    explanationAm: v.string(),
    imageId: v.optional(v.id("_storage")),
    isVerified: v.boolean(),
  })
    .index("by_exam", ["examId", "order"])
    .index("by_exam_unit", ["examId", "unit"]),

  /**
   * An immutable graded sitting. `score` is marks earned and
   * `availableMarks` is what the graded questions were worth, so a paper with
   * weighted questions scores correctly without changing the table shape.
   */
  attempts: defineTable({
    userId: v.id("users"),
    examId: v.id("exams"),
    subjectSlug: v.optional(v.string()),
    trackSlug: v.optional(v.string()),
    mode: v.optional(attemptModeValues),
    score: v.number(),
    availableMarks: v.optional(v.number()),
    correctCount: v.optional(v.number()),
    totalQuestions: v.number(),
    durationSec: v.number(),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedKey: v.string(),
        isCorrect: v.boolean(),
        marks: v.optional(v.number()),
        timeSec: v.number(),
      }),
    ),
    completedAt: v.number(),
  })
    .index("by_user", ["userId", "completedAt"])
    .index("by_exam", ["examId"])
    .index("by_completed", ["completedAt"])
    .index("by_user_subject", ["userId", "subjectSlug", "completedAt"]),

  /**
   * A recorded subject mark that feeds the student's projected track total.
   * `source: "attempt"` rows are written automatically when a full mock paper
   * is submitted; `source: "manual"` rows are typed in by the student for a
   * paper they sat elsewhere (a school mock, a private exam).
   *
   * `subjectMaxMarks` is snapshotted at write time so a later admin change to
   * the subject does not silently rewrite history.
   */
  markEntries: defineTable({
    userId: v.id("users"),
    trackSlug: v.string(),
    subjectSlug: v.string(),
    source: v.union(v.literal("attempt"), v.literal("manual")),
    score: v.number(),
    availableMarks: v.optional(v.number()),
    subjectMaxMarks: v.number(),
    attemptId: v.optional(v.id("attempts")),
    label: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_track", ["userId", "trackSlug", "createdAt"])
    .index("by_user_subject", ["userId", "subjectSlug", "createdAt"]),

  bookmarks: defineTable({
    userId: v.id("users"),
    questionId: v.id("questions"),
  })
    .index("by_user", ["userId"])
    .index("by_user_question", ["userId", "questionId"]),

  /**
   * Per-subject syllabus outline with unit weights, used to weight topic
   * coverage and to label question banks.
   */
  blueprints: defineTable({
    subjectSlug: v.string(),
    units: v.array(
      v.object({
        name: v.string(),
        weightPercent: v.number(),
        chapters: v.optional(v.array(v.string())),
      }),
    ),
  }).index("by_subject", ["subjectSlug"]),

  questionReports: defineTable({
    userId: v.id("users"),
    questionId: v.id("questions"),
    reason: v.string(),
    reporterUsername: v.optional(v.string()),
    reporterTelegramId: v.optional(v.string()),
    notifiedAt: v.optional(v.number()),
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    createdAt: v.optional(v.number()),
    note: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_question", ["questionId"])
    .index("by_user_question", ["userId", "questionId"]),

  settings: defineTable({
    key: v.string(),
    proPriceEtb: v.number(),
    /** The matric exam date. Pro access runs until here. */
    examSeasonEndAt: v.number(),
    paymentInstructionsAm: v.string(),
    paymentInstructionsEn: v.string(),
    telebirrNumber: v.optional(v.string()),
    cbeNumber: v.optional(v.string()),
    telebirrName: v.optional(v.string()),
    cbeName: v.optional(v.string()),
    /** Free students' daily question allowance across exams and duels. */
    freeDailyQuestionCap: v.optional(v.number()),
    /** Free students' full mock papers per calendar month. */
    freeMockLimitPerMonth: v.number(),
    /** Whether students may type in their own off-platform paper scores. */
    allowManualMarkEntry: v.optional(v.boolean()),
  }).index("by_key", ["key"]),

  auditLog: defineTable({
    adminEmail: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  mistakeBank: defineTable({
    userId: v.id("users"),
    questionId: v.id("questions"),
    subjectSlug: v.string(),
    trackSlug: v.optional(v.string()),
    examId: v.optional(v.id("exams")),
    wrongCount: v.number(),
    mastered: v.boolean(),
    lastAttemptAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_question", ["userId", "questionId"])
    .index("by_user_subject", ["userId", "subjectSlug"])
    .index("by_user_time", ["userId", "lastAttemptAt"])
    .index("by_user_mastered", ["userId", "mastered"])
    .index("by_user_mastered_time", ["userId", "mastered", "lastAttemptAt"])
    .index("by_user_subject_time", ["userId", "subjectSlug", "lastAttemptAt"])
    .index("by_user_subject_mastered_time", [
      "userId",
      "subjectSlug",
      "mastered",
      "lastAttemptAt",
    ]),

  mistakeStats: defineTable({
    userId: v.id("users"),
    subjectSlug: v.string(),
    totalCount: v.number(),
    masteredCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_subject", ["userId", "subjectSlug"]),

  chatSessions: defineTable({
    token: v.string(),
    telegramId: v.string(),
    userId: v.id("users"),
    mode: v.union(
      v.literal("quick"),
      v.literal("mock"),
      v.literal("daily"),
      v.literal("mistakes"),
    ),
    examId: v.id("exams"),
    subjectSlug: v.optional(v.string()),
    trackSlug: v.optional(v.string()),
    questionIds: v.array(v.id("questions")),
    currentIndex: v.number(),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedKey: v.string(),
        timeSec: v.number(),
        isCorrect: v.boolean(),
      }),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("awaiting_next"),
      v.literal("completed"),
      v.literal("abandoned"),
    ),
    startedAt: v.number(),
    lastQuestionAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_telegramId", ["telegramId"])
    .index("by_telegram_and_status", ["telegramId", "status"])
    .index("by_telegram_status_activity", ["telegramId", "status", "lastQuestionAt"])
    .index("by_status_last_activity", ["status", "lastQuestionAt"]),

  chatIntents: defineTable({
    telegramId: v.string(),
    kind: v.literal("pro_photo"),
    transactionRef: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_telegram", ["telegramId"]),

  duels: defineTable({
    code: v.string(),
    creatorId: v.id("users"),
    subjectSlug: v.string(),
    trackSlug: v.optional(v.string()),
    questionIds: v.array(v.id("questions")),
    status: v.union(
      v.literal("waiting"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("expired"),
    ),
    creatorScore: v.optional(v.number()),
    creatorTimeSec: v.optional(v.number()),
    creatorAnswers: v.optional(
      v.array(
        v.object({
          questionId: v.id("questions"),
          selectedKey: v.string(),
          isCorrect: v.boolean(),
        }),
      ),
    ),
    opponentId: v.optional(v.id("users")),
    opponentScore: v.optional(v.number()),
    opponentTimeSec: v.optional(v.number()),
    opponentAnswers: v.optional(
      v.array(
        v.object({
          questionId: v.id("questions"),
          selectedKey: v.string(),
          isCorrect: v.boolean(),
        }),
      ),
    ),
    winnerId: v.optional(v.id("users")),
    createdAt: v.number(),
    creatorPlayedAt: v.optional(v.number()),
    opponentPlayedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    maxPlayers: v.optional(v.number()),
    playerCount: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_creator", ["creatorId"])
    .index("by_creator_created", ["creatorId", "createdAt"])
    .index("by_opponent", ["opponentId"])
    .index("by_subject", ["subjectSlug"]),

  duelPlayers: defineTable({
    duelId: v.id("duels"),
    userId: v.id("users"),
    seat: v.number(),
    playerName: v.optional(v.string()),
    joinedAt: v.number(),
    playedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    timeSec: v.optional(v.number()),
    answers: v.optional(
      v.array(
        v.object({
          questionId: v.id("questions"),
          selectedKey: v.string(),
          isCorrect: v.boolean(),
        }),
      ),
    ),
  })
    .index("by_duel", ["duelId"])
    .index("by_user", ["userId"])
    .index("by_user_joined", ["userId", "joinedAt"])
    .index("by_user_played", ["userId", "playedAt"])
    .index("by_duel_and_user", ["duelId", "userId"]),

  groupDuelSetups: defineTable({
    token: v.string(),
    chatId: v.number(),
    ownerTelegramId: v.string(),
    ownerUserId: v.id("users"),
    subjectSlug: v.optional(v.string()),
    questionCount: v.optional(v.number()),
    maxPlayers: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("done")),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_chat_owner", ["chatId", "ownerTelegramId"])
    .index("by_owner", ["ownerTelegramId"]),

  groupDuels: defineTable({
    code: v.string(),
    chatId: v.number(),
    creatorId: v.id("users"),
    creatorTelegramId: v.string(),
    subjectSlug: v.string(),
    trackSlug: v.optional(v.string()),
    lang: v.union(v.literal("en"), v.literal("am")),
    questionIds: v.array(v.id("questions")),
    questionCount: v.number(),
    maxPlayers: v.number(),
    status: v.union(
      v.literal("waiting"),
      v.literal("question"),
      v.literal("reveal"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    currentIndex: v.number(),
    roundStartedAt: v.number(),
    winnerId: v.optional(v.id("users")),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_chat_status", ["chatId", "status"])
    .index("by_creator", ["creatorId"]),

  groupDuelPlayers: defineTable({
    duelId: v.id("groupDuels"),
    userId: v.id("users"),
    telegramId: v.string(),
    name: v.string(),
    score: v.number(),
    totalTimeMs: v.number(),
    joinedAt: v.number(),
    lockedIndex: v.optional(v.number()),
    answers: v.array(
      v.object({
        index: v.number(),
        selectedKey: v.string(),
        isCorrect: v.boolean(),
        timeMs: v.number(),
      }),
    ),
  })
    .index("by_duel", ["duelId"])
    .index("by_duel_and_user", ["duelId", "userId"]),

  appStats: defineTable({
    key: v.string(),
    totalUsers: v.number(),
    proUsers: v.number(),
    exams: v.number(),
    questions: v.number(),
    attempts: v.number(),
    totalXp: v.number(),
    tracks: v.number(),
    publishedTracks: v.number(),
    subjects: v.optional(v.number()),
    publishedSubjects: v.optional(v.number()),
    publishedExams: v.optional(v.number()),
    publishedQuestions: v.optional(v.number()),
  }).index("by_key", ["key"]),

  appStatShards: defineTable({
    key: v.string(),
    shard: v.number(),
    attempts: v.number(),
    totalXp: v.number(),
    totalUsers: v.optional(v.number()),
    proUsers: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_key_shard", ["key", "shard"]),

  translationOverrides: defineTable({
    namespace: v.union(v.literal("app"), v.literal("bot")),
    key: v.string(),
    textEn: v.string(),
    textAm: v.string(),
    updatedAt: v.number(),
  }).index("by_namespace_key", ["namespace", "key"]),

  trackedLinks: defineTable({
    code: v.string(),
    label: v.string(),
    target: v.union(v.literal("app"), v.literal("bot"), v.literal("url")),
    path: v.optional(v.string()),
    url: v.optional(v.string()),
    startParam: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    starts: v.number(),
    uniqueUsers: v.number(),
    signups: v.number(),
    lastEventAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_created", ["createdAt"])
    .index("by_active", ["isActive"]),

  linkEvents: defineTable({
    linkId: v.id("trackedLinks"),
    code: v.string(),
    kind: v.union(v.literal("start"), v.literal("signup")),
    telegramId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_link", ["linkId"])
    .index("by_link_created", ["linkId", "createdAt"])
    .index("by_link_telegram", ["linkId", "telegramId"])
    .index("by_created", ["createdAt"]),

  broadcasts: defineTable({
    name: v.string(),
    bodyEn: v.string(),
    bodyAm: v.string(),
    buttons: v.array(broadcastButtonValidator),
    audience: broadcastAudienceValidator,
    scheduleKind: broadcastScheduleKindValues,
    startAt: v.optional(v.number()),
    intervalMinutes: v.optional(v.number()),
    endAt: v.optional(v.number()),
    status: broadcastStatusValues,
    nextRunAt: v.optional(v.number()),
    lastRunAt: v.optional(v.number()),
    runCount: v.number(),
    sentCount: v.number(),
    failedCount: v.number(),
    lastError: v.optional(v.string()),
    cursor: v.optional(v.string()),
    ticking: v.optional(v.boolean()),
    lastTickAt: v.optional(v.number()),
    currentRunId: v.optional(v.id("broadcastRuns")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_next_run", ["nextRunAt"])
    .index("by_created", ["createdAt"]),

  broadcastRuns: defineTable({
    broadcastId: v.id("broadcasts"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    sent: v.number(),
    failed: v.number(),
    error: v.optional(v.string()),
  }).index("by_broadcast", ["broadcastId", "startedAt"]),
});
