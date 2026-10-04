import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./lib/auth";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { tgSendMessage } from "./lib/telegram";
import { bumpAppStats, bumpPublishedExamCount, publishedExamCountFor } from "./quota";

const optionValidator = v.object({
  key: v.string(),
  textEn: v.string(),
  textAm: v.string(),
});

async function audit(
  ctx: MutationCtx,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: string,
) {
  await ctx.db.insert("auditLog", {
    adminEmail,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: Date.now(),
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * A track's total is never stored as a hand-entered number: it is the sum of
 * its published subjects' maxMarks. Recomputed on every subject mutation so
 * the student totals screen stays a single indexed read.
 */
export async function recomputeTrackTotal(
  ctx: MutationCtx,
  trackSlug: string,
): Promise<void> {
  const track = await ctx.db
    .query("tracks")
    .withIndex("by_slug", (q) => q.eq("slug", trackSlug))
    .unique();
  if (!track) return;

  const subjects = await ctx.db
    .query("subjects")
    .withIndex("by_track", (q) => q.eq("trackSlug", trackSlug))
    .collect();

  const published = subjects.filter((subject) => subject.isPublished);

  await ctx.db.patch(track._id, {
    publishedSubjectCount: published.length,
    totalMaxMarks: published.reduce((sum, s) => sum + (s.maxMarks ?? 0), 0),
  });
}

/** Removes a subject's papers, their questions, and its blueprint. */
async function deleteSubjectCascade(
  ctx: MutationCtx,
  subjectSlug: string,
): Promise<number> {
  const exams = await ctx.db
    .query("exams")
    .withIndex("by_subject", (q) => q.eq("subjectSlug", subjectSlug))
    .collect();

  for (const exam of exams) {
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", exam._id))
      .collect();
    for (const question of questions) {
      await ctx.db.delete(question._id);
    }
    await ctx.db.delete(exam._id);
  }

  const blueprint = await ctx.db
    .query("blueprints")
    .withIndex("by_subject", (q) => q.eq("subjectSlug", subjectSlug))
    .unique();
  if (blueprint) {
    await ctx.db.delete(blueprint._id);
  }

  return exams.length;
}

export const listTracks = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const tracks = await ctx.db.query("tracks").collect();

    return Promise.all(
      tracks
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(async (track) => {
          const subjects = await ctx.db
            .query("subjects")
            .withIndex("by_track", (q) => q.eq("trackSlug", track.slug))
            .collect();
          const published = subjects.filter((subject) => subject.isPublished);

          const examCounts = await Promise.all(
            published.map((subject) =>
              publishedExamCountFor(
                ctx,
                subject.slug,
                subject.publishedExamCount,
              ),
            ),
          );

          return {
            ...track,
            subjectCount: subjects.length,
            publishedSubjectCount: published.length,
            examCount: examCounts.reduce((sum, n) => sum + n, 0),
          };
        }),
    );
  },
});

export const upsertTrack = mutation({
  args: {
    adminSecret: v.string(),
    id: v.optional(v.id("tracks")),
    slug: v.optional(v.string()),
    nameEn: v.string(),
    nameAm: v.string(),
    isProOnly: v.boolean(),
    isPublished: v.boolean(),
    sortOrder: v.number(),
    icon: v.optional(v.string()),
    accent: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionAm: v.optional(v.string()),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const slug = args.slug?.trim() || slugify(args.nameEn);
    if (!slug) {
      throw new Error("Track slug is required");
    }

    const existingBySlug = await ctx.db
      .query("tracks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    const payload = {
      slug,
      nameEn: args.nameEn.trim(),
      nameAm: args.nameAm.trim(),
      isProOnly: args.isProOnly,
      isPublished: args.isPublished,
      sortOrder: args.sortOrder,
      icon: args.icon,
      accent: args.accent,
      descriptionEn: args.descriptionEn,
      descriptionAm: args.descriptionAm,
    };

    if (args.id) {
      const current = await ctx.db.get(args.id);
      if (!current) throw new Error("Track not found");
      if (existingBySlug && existingBySlug._id !== args.id) {
        throw new Error("Another track already uses this slug");
      }

      if (current.slug !== slug) {
        // Re-key the whole subtree so renaming a track never orphans papers.
        const subjects = await ctx.db
          .query("subjects")
          .withIndex("by_track", (q) => q.eq("trackSlug", current.slug))
          .collect();
        for (const subject of subjects) {
          await ctx.db.patch(subject._id, { trackSlug: slug });
          const exams = await ctx.db
            .query("exams")
            .withIndex("by_subject", (q) => q.eq("subjectSlug", subject.slug))
            .collect();
          for (const exam of exams) {
            await ctx.db.patch(exam._id, { trackSlug: slug });
          }
        }
      }

      await ctx.db.patch(args.id, payload);
      await recomputeTrackTotal(ctx, current.slug);
      if (current.slug !== slug) {
        await recomputeTrackTotal(ctx, slug);
      }
      await audit(ctx, adminEmail, "track.update", "tracks", args.id);
      return args.id;
    }

    if (existingBySlug) {
      throw new Error("Track slug already exists");
    }

    const id = await ctx.db.insert("tracks", {
      ...payload,
      publishedSubjectCount: 0,
      publishedExamCount: 0,
      totalMaxMarks: 0,
    });
    await bumpAppStats(ctx, {
      tracks: 1,
      publishedTracks: args.isPublished ? 1 : 0,
    });
    await audit(ctx, adminEmail, "track.create", "tracks", id);
    return id;
  },
});

export const deleteTrack = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("tracks"),
    adminEmail: v.string(),
    cascade: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const track = await ctx.db.get(args.id);
    if (!track) throw new Error("Track not found");

    const subjects = await ctx.db
      .query("subjects")
      .withIndex("by_track", (q) => q.eq("trackSlug", track.slug))
      .collect();

    let examTotal = 0;
    for (const subject of subjects) {
      examTotal += (
        await ctx.db
          .query("exams")
          .withIndex("by_subject", (q) => q.eq("subjectSlug", subject.slug))
          .collect()
      ).length;
    }

    if ((subjects.length > 0 || examTotal > 0) && !args.cascade) {
      throw new Error(
        `This track has ${subjects.length} subject(s) and ${examTotal} exam(s). Enable cascade to delete them too.`,
      );
    }

    for (const subject of subjects) {
      await deleteSubjectCascade(ctx, subject.slug);
    }

    await ctx.db.delete(args.id);
    await audit(
      ctx,
      adminEmail,
      "track.delete",
      "tracks",
      args.id,
      track.slug,
    );
  },
});

export const listSubjects = query({
  args: {
    adminSecret: v.string(),
    trackSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);

    const subjects =
      args.trackSlug === undefined
        ? await ctx.db.query("subjects").collect()
        : await ctx.db
            .query("subjects")
            .withIndex("by_track", (q) => q.eq("trackSlug", args.trackSlug as string))
            .collect();

    return Promise.all(
      subjects
        .slice()
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
        )
        .map(async (subject) => ({
          ...subject,
          examCount: await publishedExamCountFor(
            ctx,
            subject.slug,
            subject.publishedExamCount,
          ),
        })),
    );
  },
});

export const upsertSubject = mutation({
  args: {
    adminSecret: v.string(),
    id: v.optional(v.id("subjects")),
    trackSlug: v.string(),
    slug: v.optional(v.string()),
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
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);

    const track = await ctx.db
      .query("tracks")
      .withIndex("by_slug", (q) => q.eq("slug", args.trackSlug))
      .unique();
    if (!track) throw new Error("Track not found");

    const slug = args.slug?.trim() || slugify(args.nameEn);
    if (!slug) {
      throw new Error("Subject slug is required");
    }

    const existingBySlug = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existingBySlug && existingBySlug._id !== args.id) {
      throw new Error("Another subject already uses this slug");
    }

    const payload = {
      slug,
      trackSlug: args.trackSlug,
      nameEn: args.nameEn.trim(),
      nameAm: args.nameAm.trim(),
      maxMarks: args.maxMarks,
      isProOnly: args.isProOnly,
      isPublished: args.isPublished,
      sortOrder: args.sortOrder,
      icon: args.icon,
      accent: args.accent,
      descriptionEn: args.descriptionEn,
      descriptionAm: args.descriptionAm,
    };

    if (args.id) {
      const current = await ctx.db.get(args.id);
      if (!current) throw new Error("Subject not found");

      if (current.slug !== slug) {
        // Keep existing papers attached when a subject is renamed.
        const exams = await ctx.db
          .query("exams")
          .withIndex("by_subject", (q) => q.eq("subjectSlug", current.slug))
          .collect();
        for (const exam of exams) {
          await ctx.db.patch(exam._id, { subjectSlug: slug });
        }
      }

      await ctx.db.patch(args.id, payload);
      await recomputeTrackTotal(ctx, current.trackSlug);
      if (current.trackSlug !== args.trackSlug) {
        await recomputeTrackTotal(ctx, args.trackSlug);
      }
      await audit(ctx, adminEmail, "subject.update", "subjects", args.id);
      return args.id;
    }

    const id = await ctx.db.insert("subjects", {
      ...payload,
      publishedExamCount: 0,
    });
    await recomputeTrackTotal(ctx, args.trackSlug);
    await audit(ctx, adminEmail, "subject.create", "subjects", id);
    return id;
  },
});

export const deleteSubject = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("subjects"),
    adminEmail: v.string(),
    cascade: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const subject = await ctx.db.get(args.id);
    if (!subject) throw new Error("Subject not found");

    const exams = await ctx.db
      .query("exams")
      .withIndex("by_subject", (q) => q.eq("subjectSlug", subject.slug))
      .collect();

    if (exams.length && !args.cascade) {
      throw new Error(
        `This subject has ${exams.length} exam(s). Enable cascade to delete them too.`,
      );
    }

    await deleteSubjectCascade(ctx, subject.slug);
    await ctx.db.delete(args.id);
    await recomputeTrackTotal(ctx, subject.trackSlug);
    await audit(
      ctx,
      adminEmail,
      "subject.delete",
      "subjects",
      args.id,
      subject.slug,
    );
  },
});

export const listExams = query({
  args: {
    adminSecret: v.string(),
    paginationOpts: paginationOptsValidator,
    subjectSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const scoped = args.subjectSlug
      ? ctx.db
          .query("exams")
          .withIndex("by_subject", (q) => q.eq("subjectSlug", args.subjectSlug!))
      : ctx.db.query("exams");
    const result = await scoped.order("desc").paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (exam) => {
          const questions = await ctx.db
            .query("questions")
            .withIndex("by_exam", (q) => q.eq("examId", exam._id))
            .collect();
          return {
            ...exam,
            actualQuestionCount: questions.length,
          };
        }),
      ),
    };
  },
});

/** Lightweight exam list for select inputs (metadata only, no per-exam counts). */
export const listExamOptions = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const exams = await ctx.db.query("exams").collect();
    return exams
      .sort((a, b) => b.year - a.year)
      .map((exam) => ({
        _id: exam._id,
        subjectSlug: exam.subjectSlug,
        titleEn: exam.titleEn,
        year: exam.year,
        variant: exam.variant,
        questionCount: exam.questionCount,
      }));
  },
});

export const upsertExam = mutation({
  args: {
    adminSecret: v.string(),
    id: v.optional(v.id("exams")),
    subjectSlug: v.string(),
    year: v.number(),
    variant: v.union(v.literal("regular"), v.literal("model")),
    questionCount: v.number(),
    durationMinutes: v.number(),
    isPublished: v.boolean(),
    titleEn: v.optional(v.string()),
    titleAm: v.optional(v.string()),
    isProOnly: v.optional(v.boolean()),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", args.subjectSlug))
      .unique();
    if (!subject) {
      throw new Error("Subject not found. Create it under Subjects first.");
    }

    const payload = {
      subjectSlug: args.subjectSlug,
      year: args.year,
      variant: args.variant,
      questionCount: args.questionCount,
      durationMinutes: args.durationMinutes,
      isPublished: args.isPublished,
      titleEn: args.titleEn,
      titleAm: args.titleAm,
      isProOnly: args.isProOnly ?? false,
    };

    if (args.id) {
      const exam = await ctx.db.get(args.id);
      if (!exam) throw new Error("Exam not found");
      await ctx.db.patch(args.id, payload);
      if (exam.subjectSlug !== args.subjectSlug || exam.isPublished !== args.isPublished) {
        if (exam.isPublished) {
          await bumpPublishedExamCount(ctx, exam.subjectSlug, -1);
        }
        if (args.isPublished) {
          await bumpPublishedExamCount(ctx, args.subjectSlug, 1);
        }
      }
      if (exam.isPublished !== args.isPublished) {
        await bumpAppStats(ctx, {
          publishedExams: args.isPublished ? 1 : -1,
          publishedQuestions: args.isPublished
            ? exam.questionCount
            : -exam.questionCount,
        });
      }
      await audit(ctx, adminEmail, "exam.update", "exams", args.id);
      return args.id;
    }

    const id = await ctx.db.insert("exams", payload);
    if (args.isPublished) {
      await bumpPublishedExamCount(ctx, args.subjectSlug, 1);
    }
    await bumpAppStats(ctx, {
      exams: 1,
      publishedExams: args.isPublished ? 1 : 0,
    });
    await audit(ctx, adminEmail, "exam.create", "exams", id);
    return id;
  },
});

export const deleteExam = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("exams"),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const exam = await ctx.db.get(args.id);
    if (!exam) throw new Error("Exam not found");

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", args.id))
      .collect();

    for (const question of questions) {
      await ctx.db.delete(question._id);
    }

    await ctx.db.delete(args.id);
    if (exam.isPublished) {
      await bumpPublishedExamCount(ctx, exam.subjectSlug, -1);
    }
    await bumpAppStats(ctx, {
      exams: -1,
      questions: -questions.length,
      publishedExams: exam.isPublished ? -1 : 0,
      publishedQuestions: exam.isPublished ? -questions.length : 0,
    });
    await audit(ctx, adminEmail, "exam.delete", "exams", args.id);
  },
});

async function deleteTableBatch(ctx: MutationCtx, table: Parameters<MutationCtx["db"]["query"]>[0], batchSize = 128) {
  let removed = 0;
  while (true) {
    const docs = await ctx.db.query(table).take(batchSize);
    if (docs.length === 0) {
      break;
    }
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
      removed += 1;
    }
  }
  return removed;
}

/** Removes every exam, question, and dependent records (attempts, duels, etc.). */
export const purgeAllExams = mutation({
  args: {
    adminSecret: v.string(),
    adminEmail: v.string(),
    confirm: v.literal("DELETE_ALL_EXAMS"),
  },
  returns: v.object({
    examsRemoved: v.number(),
    questionsRemoved: v.number(),
    attemptsRemoved: v.number(),
  }),
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    let questionCount = 0;
    let examsRemoved = 0;

    await deleteTableBatch(ctx, "questionReports");
    await deleteTableBatch(ctx, "bookmarks");
    await deleteTableBatch(ctx, "mistakeBank");
    const attemptCount = await deleteTableBatch(ctx, "attempts");
    await deleteTableBatch(ctx, "chatSessions");
    await deleteTableBatch(ctx, "duelPlayers");
    await deleteTableBatch(ctx, "duels");

    while (true) {
      const exams = await ctx.db.query("exams").take(16);
      if (exams.length === 0) {
        break;
      }
      for (const exam of exams) {
        const questions = await ctx.db
          .query("questions")
          .withIndex("by_exam", (q) => q.eq("examId", exam._id))
          .collect();
        for (const question of questions) {
          await ctx.db.delete(question._id);
        }
        questionCount += questions.length;
        if (exam.isPublished) {
          await bumpPublishedExamCount(ctx, exam.subjectSlug, -1);
        }
        await ctx.db.delete(exam._id);
        examsRemoved += 1;
      }
    }

    if (examsRemoved > 0 || questionCount > 0 || attemptCount > 0) {
      await bumpAppStats(ctx, {
        exams: -examsRemoved,
        questions: -questionCount,
        attempts: -attemptCount,
      });
    }

    await audit(
      ctx,
      adminEmail,
      "exam.purgeAll",
      "exams",
      "all",
      JSON.stringify({
        examsRemoved,
        questionsRemoved: questionCount,
        attemptsRemoved: attemptCount,
      }),
    );

    return {
      examsRemoved,
      questionsRemoved: questionCount,
      attemptsRemoved: attemptCount,
    };
  },
});

export const listQuestions = query({
  args: {
    adminSecret: v.string(),
    paginationOpts: paginationOptsValidator,
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const result = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", args.examId))
      .order("asc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (question) => ({
          ...question,
          imageUrl: question.imageId ? await ctx.storage.getUrl(question.imageId) : null,
        })),
      ),
    };
  },
});

export const upsertQuestion = mutation({
  args: {
    adminSecret: v.string(),
    id: v.optional(v.id("questions")),
    examId: v.id("exams"),
    order: v.number(),
    unit: v.string(),
    chapter: v.string(),
    bloomLevel: v.optional(v.string()),
    textEn: v.string(),
    textAm: v.string(),
    options: v.array(optionValidator),
    correctKey: v.string(),
    explanationEn: v.string(),
    explanationAm: v.string(),
    imageId: v.optional(v.id("_storage")),
    isVerified: v.boolean(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const exam = await ctx.db.get(args.examId);
    if (!exam) throw new Error("Exam not found");
    if (!args.options.some((option) => option.key === args.correctKey)) {
      throw new Error("Correct key must match one of the options");
    }

    const payload = {
      examId: args.examId,
      order: args.order,
      unit: args.unit.trim(),
      chapter: args.chapter.trim(),
      bloomLevel: args.bloomLevel,
      textEn: args.textEn.trim(),
      textAm: args.textAm.trim(),
      options: args.options,
      correctKey: args.correctKey,
      explanationEn: args.explanationEn.trim(),
      explanationAm: args.explanationAm.trim(),
      imageId: args.imageId,
      isVerified: args.isVerified,
    };

    if (args.id) {
      const question = await ctx.db.get(args.id);
      if (!question) throw new Error("Question not found");
      await ctx.db.patch(args.id, payload);
      await audit(ctx, adminEmail, "question.update", "questions", args.id);
      return args.id;
    }

    const id = await ctx.db.insert("questions", payload);
    const nextCount = exam.questionCount + 1;
    await ctx.db.patch(args.examId, { questionCount: nextCount });
    await bumpAppStats(ctx, {
      questions: 1,
      publishedQuestions: exam.isPublished ? 1 : 0,
    });
    await audit(ctx, adminEmail, "question.create", "questions", id);
    return id;
  },
});

export const deleteQuestion = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("questions"),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const question = await ctx.db.get(args.id);
    if (!question) throw new Error("Question not found");
    const examId = question.examId;
    await ctx.db.delete(args.id);
    const remaining = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", examId))
      .collect();
    const exam = await ctx.db.get(examId);
    await ctx.db.patch(examId, { questionCount: remaining.length });
    await bumpAppStats(ctx, {
      questions: -1,
      publishedQuestions: exam?.isPublished ? -1 : 0,
    });
    await audit(ctx, adminEmail, "question.delete", "questions", args.id);
  },
});

export const deleteQuestions = mutation({
  args: {
    adminSecret: v.string(),
    ids: v.array(v.id("questions")),
    adminEmail: v.string(),
  },
  returns: v.object({ deleted: v.number(), examsUpdated: v.number() }),
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const touchedExams = new Set<Id<"exams">>();
    let deleted = 0;
    let publishedDeleted = 0;

    for (const id of args.ids) {
      const question = await ctx.db.get(id);
      if (!question) continue;
      touchedExams.add(question.examId);
      const exam = await ctx.db.get(question.examId);
      if (exam?.isPublished) publishedDeleted += 1;
      await ctx.db.delete(id);
      deleted += 1;
    }

    for (const examId of touchedExams) {
      const remaining = await ctx.db
        .query("questions")
        .withIndex("by_exam", (q) => q.eq("examId", examId))
        .collect();
      remaining.sort((a, b) => a.order - b.order);
      for (let index = 0; index < remaining.length; index += 1) {
        const desiredOrder = index + 1;
        if (remaining[index].order !== desiredOrder) {
          await ctx.db.patch(remaining[index]._id, { order: desiredOrder });
        }
      }
      await ctx.db.patch(examId, {
        questionCount: remaining.length,
        durationMinutes: Math.max(
          60,
          Math.min(240, Math.round(remaining.length * 1.5)),
        ),
      });
    }

    if (deleted > 0) {
      await bumpAppStats(ctx, {
        questions: -deleted,
        publishedQuestions: -publishedDeleted,
      });
    }
    await audit(
      ctx,
      adminEmail,
      "question.batchDelete",
      "questions",
      "bulk",
      JSON.stringify({ deleted, examsUpdated: touchedExams.size }),
    );

    return { deleted, examsUpdated: touchedExams.size };
  },
});

export const setUserPro = mutation({
  args: {
    adminSecret: v.string(),
    userId: v.id("users"),
    isPro: v.boolean(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    const now = Date.now();
    const wasPro = user.isPro && (!user.proExpiresAt || user.proExpiresAt > now);
    await ctx.db.patch(args.userId, {
      isPro: args.isPro,
      proExpiresAt: args.isPro ? settings?.examSeasonEndAt ?? now : undefined,
      proApprovedAt: args.isPro ? now : undefined,
      proApprovedBy: args.isPro ? adminEmail : undefined,
    });

    if (wasPro !== args.isPro) {
      await bumpAppStats(
        ctx,
        { proUsers: args.isPro ? 1 : -1 },
        { shardKey: String(args.userId) },
      );
    }

    await audit(
      ctx,
      adminEmail,
      args.isPro ? "user.grantPro" : "user.revokePro",
      "users",
      args.userId,
    );
  },
});

export const setUserBanned = mutation({
  args: {
    adminSecret: v.string(),
    userId: v.id("users"),
    isBanned: v.boolean(),
    reason: v.optional(v.string()),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      isBanned: args.isBanned,
      bannedAt: args.isBanned ? Date.now() : undefined,
      banReason: args.isBanned ? args.reason?.trim() || undefined : undefined,
    });

    await audit(
      ctx,
      adminEmail,
      args.isBanned ? "user.ban" : "user.unban",
      "users",
      args.userId,
      args.reason,
    );
  },
});

/** Admin override: move a student to another track (bypasses the Pro lock). */
export const setUserTrack = mutation({
  args: {
    adminSecret: v.string(),
    userId: v.id("users"),
    trackSlug: v.string(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const track = await ctx.db
      .query("tracks")
      .withIndex("by_slug", (q) => q.eq("slug", args.trackSlug))
      .unique();
    if (!track) throw new Error("Track not found");

    if (user.trackSlug === args.trackSlug) return;

    await ctx.db.patch(args.userId, { trackSlug: args.trackSlug });
    await audit(
      ctx,
      adminEmail,
      "user.switchTrack",
      "users",
      args.userId,
      `${user.trackSlug ?? "none"} -> ${args.trackSlug}`,
    );
  },
});

export const setUserLanguage = mutation({
  args: {
    adminSecret: v.string(),
    userId: v.id("users"),
    language: v.union(v.literal("am"), v.literal("en")),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(args.userId, { language: args.language });
    await audit(
      ctx,
      adminEmail,
      "user.setLanguage",
      "users",
      args.userId,
      `${user.language} -> ${args.language}`,
    );
  },
});

/** Clears today's quota counters so the student can practice again immediately. */
export const resetUserQuota = mutation({
  args: {
    adminSecret: v.string(),
    userId: v.id("users"),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(args.userId, {
      dailyQuotaDate: undefined,
      dailyQuestionsUsed: undefined,
      dailyDuelsUsed: undefined,
      dailyUsage: undefined,
    });
    await audit(ctx, adminEmail, "user.resetQuota", "users", args.userId);
  },
});

export const listReports = query({
  args: {
    adminSecret: v.string(),
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(v.literal("open"), v.literal("resolved"), v.literal("dismissed")),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    const status = args.status;
    const base = status
      ? ctx.db
          .query("questionReports")
          .withIndex("by_status", (q) => q.eq("status", status))
      : ctx.db.query("questionReports");
    const result = await base.order("desc").paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (report) => {
          const user = await ctx.db.get(report.userId);
          const question = await ctx.db.get(report.questionId);
          return {
            ...report,
            user,
            question,
          };
        }),
      ),
    };
  },
});

export const resolveReport = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("questionReports"),
    status: v.union(v.literal("resolved"), v.literal("dismissed")),
    note: v.optional(v.string()),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("Report not found");
    if (report.status === args.status) return;
    await ctx.db.patch(args.id, {
      status: args.status,
      note: args.note,
    });
    if (args.status === "resolved") {
      await ctx.scheduler.runAfter(
        0,
        internal.admin.notifyReportResolved,
        { reportId: args.id },
      );
    }
    await audit(ctx, adminEmail, `report.${args.status}`, "questionReports", args.id);
  },
});

/** Telegram the reporter that their flagged question has been fixed. */
export const notifyReportResolved = internalAction({
  args: { reportId: v.id("questionReports") },
  handler: async (ctx, args) => {
    const report = await ctx.runQuery(internal.admin.getReportInternal, {
      reportId: args.reportId,
    });
    if (!report || report.status !== "resolved" || report.notifiedAt) return;

    const telegramId = report.reporterTelegramId;
    if (!telegramId) return;

    const message =
      report.reporterLanguage === "am"
        ? "âœ… <b>áˆªá–áˆ­á‰µáˆ… á‰°áˆµá‰°áŠ«áŠ­áˆáˆ!</b>\n\ná‹«áŠ•áŠ• áŒ¥á‹«á‰„ áˆµáˆµ á‰¥áˆˆáˆ… á‹«áˆ³á‹ˆá‰…áŠ¨á‹ áŒ¥á‹«á‰„ á‰°áˆµá‰°áŠ«áŠ­áˆŽ áŠ¥áŠ•á‹°áŒˆáŠ“ á‰°áŒˆáŠá‰·áˆá¢ áŠ¥áˆ­áˆµáˆ…áŠ• áˆµáˆˆáˆšá‹«áˆ»áˆ½áˆ áŠ¥áŠ“áˆ˜áˆ°áŒáŠ“áˆˆáŠ• ðŸ™Œ"
        : "âœ… <b>Your report was fixed!</b>\n\nThe question you flagged has been corrected and is live again. Thanks for helping make the exam bank better ðŸ™Œ";

    const result = await tgSendMessage({ chatId: telegramId, text: message });
    if (result.ok) {
      await ctx.runMutation(internal.admin.markReportNotified, {
        reportId: args.reportId,
      });
    }
  },
});

export const getReportInternal = internalQuery({
  args: { reportId: v.id("questionReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;
    const user = await ctx.db.get(report.userId);
    return {
      status: report.status,
      notifiedAt: report.notifiedAt,
      reporterTelegramId: report.reporterTelegramId ?? user?.telegramId ?? null,
      reporterLanguage: user?.language === "am" ? ("am" as const) : ("en" as const),
    };
  },
});

export const markReportNotified = internalMutation({
  args: { reportId: v.id("questionReports") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, { notifiedAt: Date.now() });
  },
});

/** Resolve or dismiss every open report attached to a question. */
export const resolveQuestionReports = mutation({
  args: {
    adminSecret: v.string(),
    questionId: v.id("questions"),
    status: v.union(v.literal("resolved"), v.literal("dismissed")),
    note: v.optional(v.string()),
    adminEmail: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const reports = await ctx.db
      .query("questionReports")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();
    let count = 0;
    for (const report of reports) {
      if (report.status !== "open") continue;
      await ctx.db.patch(report._id, { status: args.status, note: args.note });
      if (args.status === "resolved") {
        await ctx.scheduler.runAfter(
          0,
          internal.admin.notifyReportResolved,
          { reportId: report._id },
        );
      }
      count += 1;
    }
    if (count > 0) {
      await audit(
        ctx,
        adminEmail,
        `report.${args.status}.bulk`,
        "questions",
        args.questionId,
      );
    }
    return count;
  },
});

/** Delete a reported question and close every report pointing at it. */
export const deleteReportedQuestion = mutation({
  args: {
    adminSecret: v.string(),
    questionId: v.id("questions"),
    adminEmail: v.string(),
  },
  returns: v.object({ deleted: v.boolean(), reportsClosed: v.number() }),
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    const examId = question.examId;

    const reports = await ctx.db
      .query("questionReports")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();
    let reportsClosed = 0;
    for (const report of reports) {
      if (report.status === "open") {
        await ctx.db.patch(report._id, { status: "resolved", note: "Question deleted" });
        await ctx.scheduler.runAfter(
          0,
          internal.admin.notifyReportResolved,
          { reportId: report._id },
        );
        reportsClosed += 1;
      }
    }

    await ctx.db.delete(args.questionId);
    const remaining = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", examId))
      .collect();
    await ctx.db.patch(examId, { questionCount: remaining.length });
    await bumpAppStats(ctx, { questions: -1 });
    await audit(ctx, adminEmail, "question.delete", "questions", args.questionId);
    return { deleted: true, reportsClosed };
  },
});

export const listAudit = query({
  args: {
    adminSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    return await ctx.db
      .query("auditLog")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 80);
  },
});

export const getBlueprint = query({
  args: {
    adminSecret: v.string(),
    subjectSlug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(args.adminSecret);
    return await ctx.db
      .query("blueprints")
      .withIndex("by_subject", (q) => q.eq("subjectSlug", args.subjectSlug))
      .unique();
  },
});

export const upsertBlueprint = mutation({
  args: {
    adminSecret: v.string(),
    subjectSlug: v.string(),
    units: v.array(
      v.object({
        name: v.string(),
        weightPercent: v.number(),
        courses: v.array(
          v.object({
            name: v.string(),
            ects: v.optional(v.number()),
          }),
        ),
      }),
    ),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    const existing = await ctx.db
      .query("blueprints")
      .withIndex("by_subject", (q) => q.eq("subjectSlug", args.subjectSlug))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { units: args.units });
      await audit(ctx, adminEmail, "blueprint.update", "blueprints", existing._id);
      return existing._id;
    }

    const id = await ctx.db.insert("blueprints", {
      subjectSlug: args.subjectSlug,
      units: args.units,
    });
    await audit(ctx, adminEmail, "blueprint.create", "blueprints", id);
    return id;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

const sourcedOptionValidator = v.object({
  key: v.string(),
  text: v.string(),
  textAm: v.optional(v.string()),
});

const sourcedQuestionValidator = v.object({
  order: v.number(),
  unit: v.string(),
  chapter: v.string(),
  bloomLevel: v.optional(v.string()),
  text: v.string(),
  textAm: v.optional(v.string()),
  options: v.array(sourcedOptionValidator),
  correctKey: v.string(),
  explanation: v.string(),
  explanationAm: v.optional(v.string()),
  isVerified: v.boolean(),
});

const importSourcedExamArgs = {
  adminEmail: v.string(),
  adminSecret: v.string(),
  subjectSlug: v.string(),
  year: v.number(),
  variant: v.union(v.literal("regular"), v.literal("model")),
  title: v.string(),
  durationMinutes: v.number(),
  isPublished: v.optional(v.boolean()),
  isProOnly: v.optional(v.boolean()),
  sourceUrl: v.optional(v.string()),
  sourceType: v.optional(v.string()),
  questions: v.array(sourcedQuestionValidator),
};

function normalizeQuestionDedupeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Papers hang off subjects, not tracks, so the subject must already exist.
 * Admins create subjects under Admin -> Subjects; this used to silently
 * insert a row into the tracks table instead.
 */
async function requireSubject(ctx: MutationCtx, subjectSlug: string) {
  const subject = await ctx.db
    .query("subjects")
    .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
    .unique();
  if (!subject) {
    throw new Error(
      `Subject "${subjectSlug}" does not exist. Create it under Subjects first.`,
    );
  }
  return subject;
}

async function insertSourcedQuestions(
  ctx: MutationCtx,
  examId: Id<"exams">,
  title: string,
  questions: Array<{
    order: number;
    unit: string;
    chapter: string;
    bloomLevel?: string;
    text: string;
    textAm?: string;
    options: Array<{ key: string; text: string; textAm?: string }>;
    correctKey: string;
    explanation: string;
    explanationAm?: string;
    isVerified: boolean;
  }>,
  startOrder: number,
) {
  let order = startOrder;
  for (const question of questions) {
    const normalizedKey = question.correctKey.trim().toUpperCase();
    if (!question.options.some((option) => option.key === normalizedKey)) {
      throw new Error(
        `"${title}" question ${question.order}: correctKey "${question.correctKey}" must match an option (${question.options.map((o) => o.key).join(", ")})`,
      );
    }
    if (question.options.length < 2) {
      throw new Error(
        `"${title}" question ${question.order}: needs at least 2 options`,
      );
    }
    if (!question.text.trim()) {
      throw new Error(`"${title}" question ${question.order}: text is required`);
    }
    const options = question.options.map((option) => ({
      key: option.key.trim().toUpperCase(),
      textEn: option.text.trim(),
      textAm: option.textAm?.trim() || "",
    }));
    await ctx.db.insert("questions", {
      examId,
      order,
      unit: question.unit.trim(),
      chapter: question.chapter.trim(),
      bloomLevel: question.bloomLevel,
      textEn: question.text.trim(),
      textAm: question.textAm?.trim() || "",
      options,
      correctKey: normalizedKey,
      explanationEn: question.explanation.trim(),
      explanationAm: question.explanationAm?.trim() || "",
      isVerified: question.isVerified,
    });
    order += 1;
  }
  return order - startOrder;
}

export const importSourcedExam = mutation({
  args: importSourcedExamArgs,
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    await requireSubject(ctx, args.subjectSlug);

    const isPublished = args.isPublished ?? false;
    const examId = await ctx.db.insert("exams", {
      subjectSlug: args.subjectSlug,
      year: args.year,
      variant: args.variant,
      questionCount: args.questions.length,
      durationMinutes: args.durationMinutes,
      isPublished,
      titleEn: args.title,
      titleAm: undefined,
      isProOnly: args.isProOnly ?? false,
    });

    await insertSourcedQuestions(ctx, examId, args.title, args.questions, 1);

    if (isPublished) {
      await bumpPublishedExamCount(ctx, args.subjectSlug, 1);
    }
    await bumpAppStats(ctx, {
      exams: 1,
      questions: args.questions.length,
    });

    await audit(
      ctx,
      adminEmail,
      "exam.importSourced",
      "exams",
      examId,
      JSON.stringify({
        sourceUrl: args.sourceUrl,
        questionCount: args.questions.length,
      }),
    );

    return { examId, questionCount: args.questions.length };
  },
});

/** Import new exam or append QC-passed questions to an existing exam (deduped by stem). */
export const mergeSourcedExam = mutation({
  args: importSourcedExamArgs,
  returns: v.object({
    examId: v.id("exams"),
    createdExam: v.boolean(),
    addedQuestions: v.number(),
    skippedDuplicates: v.number(),
    totalQuestions: v.number(),
  }),
  handler: async (ctx, args) => {
    const adminEmail = await requireAdmin(args.adminSecret);
    await requireSubject(ctx, args.subjectSlug);

    const isPublished = args.isPublished ?? true;
    const candidates = await ctx.db
      .query("exams")
      .withIndex("by_subject", (q) =>
        q.eq("subjectSlug", args.subjectSlug).eq("year", args.year),
      )
      .collect();
    const existing =
      candidates.find(
        (exam) => exam.variant === args.variant && exam.titleEn === args.title,
      ) ?? candidates.find((exam) => exam.variant === args.variant);

    if (!existing) {
      const examId = await ctx.db.insert("exams", {
        subjectSlug: args.subjectSlug,
        year: args.year,
        variant: args.variant,
        questionCount: args.questions.length,
        durationMinutes: args.durationMinutes,
        isPublished,
        titleEn: args.title,
        titleAm: undefined,
        isProOnly: args.isProOnly ?? false,
      });

      await insertSourcedQuestions(ctx, examId, args.title, args.questions, 1);

      if (isPublished) {
        await bumpPublishedExamCount(ctx, args.subjectSlug, 1);
      }
      await bumpAppStats(ctx, {
        exams: 1,
        questions: args.questions.length,
      });

      await audit(
        ctx,
        adminEmail,
        "exam.mergeSourced.create",
        "exams",
        examId,
        JSON.stringify({ questionCount: args.questions.length }),
      );

      return {
        examId,
        createdExam: true,
        addedQuestions: args.questions.length,
        skippedDuplicates: 0,
        totalQuestions: args.questions.length,
      };
    }

    const existingQuestions = await ctx.db
      .query("questions")
      .withIndex("by_exam", (q) => q.eq("examId", existing._id))
      .collect();
    const seen = new Set(
      existingQuestions.map((q) => normalizeQuestionDedupeKey(q.textEn)),
    );

    const toAdd = args.questions.filter((question) => {
      const key = normalizeQuestionDedupeKey(question.text);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    const skippedDuplicates = args.questions.length - toAdd.length;
    let totalQuestions = existingQuestions.length;

    if (toAdd.length > 0) {
      const startOrder =
        existingQuestions.reduce((max, q) => Math.max(max, q.order), 0) + 1;
      const added = await insertSourcedQuestions(
        ctx,
        existing._id,
        args.title,
        toAdd,
        startOrder,
      );
      totalQuestions += added;
      const durationMinutes = Math.max(
        existing.durationMinutes,
        args.durationMinutes,
        Math.max(60, Math.min(240, Math.round(totalQuestions * 1.5))),
      );
      await ctx.db.patch(existing._id, {
        questionCount: totalQuestions,
        durationMinutes,
      });
      await bumpAppStats(ctx, { questions: added });
    }

    await audit(
      ctx,
      adminEmail,
      "exam.mergeSourced.append",
      "exams",
      existing._id,
      JSON.stringify({
        addedQuestions: toAdd.length,
        skippedDuplicates,
        totalQuestions,
      }),
    );

    return {
      examId: existing._id,
      createdExam: false,
      addedQuestions: toAdd.length,
      skippedDuplicates,
      totalQuestions,
    };
  },
});
