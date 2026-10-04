import { v } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const featuredQuestionValidator = v.object({
  _id: v.id("questions"),
  examId: v.id("exams"),
  chapter: v.string(),
  unit: v.string(),
  textEn: v.string(),
  textAm: v.string(),
  subjectSlug: v.string(),
});

export async function pickFeaturedQuestion(
  ctx: QueryCtx | MutationCtx,
  subjectSlug: string | undefined,
  dayIndex: number,
): Promise<{
  _id: Id<"questions">;
  examId: Id<"exams">;
  chapter: string;
  unit: string;
  textEn: string;
  textAm: string;
  subjectSlug: string;
} | null> {
  const slug = subjectSlug;
  if (!slug) return null;
  const exam = await ctx.db
    .query("exams")
    .withIndex("by_subject_published", (q) =>
      q.eq("subjectSlug", slug).eq("isPublished", true),
    )
    .order("desc")
    .first();
  if (!exam || exam.questionCount < 1) return null;

  const pickOrder = (Math.abs(dayIndex) % exam.questionCount) + 1;
  const question = await ctx.db
    .query("questions")
    .withIndex("by_exam", (q) => q.eq("examId", exam._id).eq("order", pickOrder))
    .first();
  if (!question) return null;

  return {
    _id: question._id,
    examId: exam._id,
    chapter: question.chapter || question.unit,
    unit: question.unit,
    textEn: question.textEn,
    textAm: question.textAm,
    subjectSlug: exam.subjectSlug,
  };
}

export const getFeaturedDailyQuestion = query({
  args: {
    subjectSlug: v.optional(v.string()),
    dayIndex: v.number(),
  },
  returns: v.union(featuredQuestionValidator, v.null()),
  handler: async (ctx, args) => {
    return await pickFeaturedQuestion(ctx, args.subjectSlug, args.dayIndex);
  },
});
