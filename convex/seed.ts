import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { recomputeTrackTotal } from "./admin";
import { bumpPublishedExamCount } from "./quota";

/**
 * One-off catalogue seed for a fresh deployment: the two study tracks, their
 * subjects, and a placeholder paper per subject so every screen has something
 * to render.
 *
 * Run with `npx convex run seed:run '{"token":"<SEED_TOKEN>"}'`.
 *
 * Requires SEED_TOKEN in the deployment env; without it the mutation refuses
 * to run, so it can never fire against production by accident. It is
 * idempotent — re-running refreshes the catalogue in place and never
 * duplicates papers or questions.
 *
 * Subjects are duplicated per track rather than shared. English and Mathematics
 * are taken by both tracks, but a subject row carries a single `trackSlug` and
 * subject slugs are globally unique, so each track gets its own row under a
 * track-prefixed slug (`natural-english`, `social-english`). Convex cannot
 * index membership of an array field, so a join table would be the only
 * alternative.
 *
 * The marks below are PLACEHOLDERS pending the official subject list and exam
 * weighting; both tracks are given the conventional 550 total. Update
 * `TRACKS` once the real figures are confirmed.
 */

const SEED_YEAR = 2025;
const QUESTIONS_PER_PAPER = 6;

type SeedSubject = {
  /** Slug fragment; the track prefix is prepended to make the final slug. */
  key: string;
  nameEn: string;
  nameAm: string;
  maxMarks: number;
};

type SeedTrack = {
  slug: string;
  nameEn: string;
  nameAm: string;
  prefix: string;
  descriptionEn: string;
  descriptionAm: string;
  subjects: SeedSubject[];
};

const TRACKS: SeedTrack[] = [
  {
    slug: "natural-science",
    nameEn: "Natural Science",
    nameAm: "ተፈጥሮ ሳይንስ",
    prefix: "natural",
    descriptionEn: "Mathematics, sciences and technical drawing.",
    descriptionAm: "ሒሳብ፣ ሳይኖች እና ቴክኒክ ስዕር።",
    subjects: [
      { key: "english", nameEn: "English", nameAm: "እንግሊዝኛ", maxMarks: 100 },
      { key: "mathematics", nameEn: "Mathematics", nameAm: "ሒሳብ", maxMarks: 100 },
      { key: "physics", nameEn: "Physics", nameAm: "ፊዚክስ", maxMarks: 80 },
      { key: "chemistry", nameEn: "Chemistry", nameAm: "ኬሚስትሪ", maxMarks: 80 },
      { key: "biology", nameEn: "Biology", nameAm: "ባዮሎጂ", maxMarks: 80 },
      {
        key: "general-science",
        nameEn: "General Science",
        nameAm: "አጠቃላይ ሳይንስ",
        maxMarks: 60,
      },
      {
        key: "technical-drawing",
        nameEn: "Technical Drawing",
        nameAm: "ቴክኒክ ስዕር",
        maxMarks: 50,
      },
    ],
  },
  {
    slug: "social-science",
    nameEn: "Social Science",
    nameAm: "ማኅበራዊ ሳይንስ",
    prefix: "social",
    descriptionEn: "Mathematics, humanities and social studies.",
    descriptionAm: "ሒሳብ፣ ሰው እና ማኅበራዊ ጥናናት።",
    subjects: [
      { key: "english", nameEn: "English", nameAm: "እንግሊዝኛ", maxMarks: 100 },
      { key: "mathematics", nameEn: "Mathematics", nameAm: "ሒሳብ", maxMarks: 100 },
      { key: "geography", nameEn: "Geography", nameAm: "ጂኦግራፊ", maxMarks: 80 },
      { key: "history", nameEn: "History", nameAm: "ታሪክ", maxMarks: 80 },
      {
        key: "civics-and-ethical-education",
        nameEn: "Civics and Ethical Education",
        nameAm: "ዜጎትና ኢትሐሳዊ ትምህርት",
        maxMarks: 80,
      },
      { key: "economics", nameEn: "Economics", nameAm: "ኢኮኖሚ", maxMarks: 60 },
      { key: "commerce", nameEn: "Commerce", nameAm: "ንግድ", maxMarks: 50 },
    ],
  },
];

function requireSeedToken(token: string) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    throw new Error(
      "SEED_TOKEN is not set on the deployment. Refusing to seed. " +
        "Set it with: npx convex env set SEED_TOKEN <value>",
    );
  }
  if (token !== expected) {
    throw new Error("Bad seed token");
  }
}

export const run = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireSeedToken(args.token);

    let tracksCreated = 0;
    let subjectsCreated = 0;
    let subjectsUpdated = 0;
    let examsCreated = 0;
    let questionsCreated = 0;

    for (const [trackIndex, track] of TRACKS.entries()) {
      const existingTrack = await ctx.db
        .query("tracks")
        .withIndex("by_slug", (q) => q.eq("slug", track.slug))
        .unique();

      const trackPayload = {
        nameEn: track.nameEn,
        nameAm: track.nameAm,
        descriptionEn: track.descriptionEn,
        descriptionAm: track.descriptionAm,
        isProOnly: false,
        isPublished: true,
        sortOrder: trackIndex,
      };

      if (existingTrack) {
        await ctx.db.patch(existingTrack._id, trackPayload);
      } else {
        await ctx.db.insert("tracks", { slug: track.slug, ...trackPayload });
        tracksCreated += 1;
      }

      for (const [subjectIndex, subject] of track.subjects.entries()) {
        const subjectSlug = `${track.prefix}-${subject.key}`;
        const subjectPayload = {
          trackSlug: track.slug,
          nameEn: subject.nameEn,
          nameAm: subject.nameAm,
          maxMarks: subject.maxMarks,
          isProOnly: false,
          isPublished: true,
          sortOrder: subjectIndex,
        };

        const existingSubject = await ctx.db
          .query("subjects")
          .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
          .unique();

        if (existingSubject) {
          await ctx.db.patch(existingSubject._id, subjectPayload);
          subjectsUpdated += 1;
        } else {
          await ctx.db.insert("subjects", {
            slug: subjectSlug,
            ...subjectPayload,
          });
          subjectsCreated += 1;
        }

        const existingExam = await ctx.db
          .query("exams")
          .withIndex("by_subject", (q) =>
            q.eq("subjectSlug", subjectSlug).eq("year", SEED_YEAR),
          )
          .filter((q) => q.eq(q.field("variant"), "regular"))
          .unique();

        let examId = existingExam?._id;
        if (!examId) {
          examId = await ctx.db.insert("exams", {
            subjectSlug,
            trackSlug: track.slug,
            year: SEED_YEAR,
            variant: "regular",
            questionCount: QUESTIONS_PER_PAPER,
            durationMinutes: QUESTIONS_PER_PAPER * 2,
            totalMarks: QUESTIONS_PER_PAPER,
            isPublished: true,
            titleEn: `${subject.nameEn} — Sample Paper ${SEED_YEAR}`,
            titleAm: `${subject.nameAm} — ናሙና ወረቀት ${SEED_YEAR}`,
          });
          examsCreated += 1;
          await bumpPublishedExamCount(ctx, subjectSlug, 1);
        }

        // Only top the paper up when it is missing questions, so re-running
        // never duplicates them.
        const hasQuestions = await ctx.db
          .query("questions")
          .withIndex("by_exam", (q) => q.eq("examId", examId!))
          .first();
        if (hasQuestions) continue;

        for (let order = 1; order <= QUESTIONS_PER_PAPER; order += 1) {
          await ctx.db.insert("questions", {
            examId: examId!,
            order,
            unit: "Sample unit",
            chapter: "Sample chapter",
            bloomLevel: "Remember",
            marks: 1,
            textEn:
              `[Sample] ${subject.nameEn} placeholder question ${order}. ` +
              "Replace via Admin → Exams.",
            textAm:
              `[ናሙና] ${subject.nameAm} ስዕር ${order}። ` +
              "በ Admin → Exams ይተካሱ።",
            options: [
              { key: "A", textEn: "Option A", textAm: "አማራጭ አ" },
              { key: "B", textEn: "Option B", textAm: "አማራጭ ቢ" },
              { key: "C", textEn: "Option C", textAm: "አማራጭ ሲ" },
              { key: "D", textEn: "Option D", textAm: "አማራጭ ዲ" },
            ],
            correctKey: "A",
            explanationEn: "Placeholder explanation.",
            explanationAm: "የስዕር ማብራሪያ።",
            isVerified: false,
          });
          questionsCreated += 1;
        }
      }

      await recomputeTrackTotal(ctx, track.slug);
    }

    return {
      tracksCreated,
      subjectsCreated,
      subjectsUpdated,
      examsCreated,
      questionsCreated,
    };
  },
});