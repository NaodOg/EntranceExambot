"use client";

import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useSubjectSelection } from "@/hooks/useSubjectSelection";
import { SubjectPicker } from "@/components/subject/SubjectPicker";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { PageHeaderSkeleton, StageListSkeleton } from "@/components/ui/Skeleton";
import { RestrictionModal } from "@/components/ui/RestrictionModal";

export default function PracticePage() {
  return (
    <Suspense fallback={<PracticeSkeleton />}>
      <PracticeClient />
    </Suspense>
  );
}

function PracticeSkeleton() {
  return (
    <main className="flex flex-col gap-5 p-4 pt-6 is-skeleton">
      <PageHeaderSkeleton titleWidth="w-52" />
      <StageListSkeleton rows={5} />
    </main>
  );
}

function PracticeClient() {
  const { telegramId, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const { subjects, slug: subjectSlug, subject, selectSubject } =
    useSubjectSelection();
  const sources = useQuery(
    api.exams.listQuestionSources,
    subjectSlug ? { subjectSlug } : "skip",
  );

  const start = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const dailyQuota = useQuery(
    api.exams.getDailyQuota,
    telegramId ? { telegramId, todayStartMs: start } : "skip",
  );

  const [restrictionModal, setRestrictionModal] = useState<"questions" | "pro_stage" | null>(null);

  const t = useAppCopy(profile?.language ?? "en");
  const current = subject;
  const isPro = profile?.isProActive ?? false;
  const freeQuestionsLeft = isPro ? Infinity : (dailyQuota?.freeQuestionsLeft ?? 20);

  const loading = sources === undefined || profile === undefined || (telegramId && dailyQuota === undefined);

  if (loading) return <PracticeSkeleton />;

  return (
    <main className="flex flex-col gap-5 p-4 pt-6">
      <RestrictionModal
        open={restrictionModal !== null}
        onClose={() => setRestrictionModal(null)}
        type={restrictionModal ?? "questions"}
      />

      <header>
        <div className="flex items-center justify-between">
          <p className="kicker">{t.practice}</p>
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            {isPro
              ? t.progProUnlimited
              : t.progQuestionsToday.replace("{left}", String(freeQuestionsLeft))}
          </span>
        </div>
        <h1 className="font-mono mt-2 text-3xl font-bold tracking-wide">{t.progSelectStage}</h1>
      </header>

      <SubjectPicker
        subjects={subjects}
        value={subjectSlug}
        onChange={selectSubject}
        label={t.subjectLabel}
        emptyLabel={t.subjectEmptyForTrack}
      />

      {current && (
        <p className="text-sm text-muted">
          {profile?.language === "am" ? current.descriptionAm : current.descriptionEn}
        </p>
      )}

      <div className="grid gap-2">
        {sources?.mock.available && (
          <Link
            href={`/app/exam?subject=${subjectSlug}&source=mock`}
            onClick={(e) => {
              if (!isPro && freeQuestionsLeft <= 0) {
                e.preventDefault();
                setRestrictionModal("questions");
              }
            }}
            className={`stage-row ${!isPro && freeQuestionsLeft <= 0 ? "opacity-75" : ""}`}
          >
            <span>
              <b>{profile?.language === "am" ? t.sourceMock : t.sourceMock.toUpperCase()}</b>
              <small>
                {t.practiceMockHint.replace("{n}", String(sources.mock.questionCount))}
                {!isPro ? t.progFreeCap : ""}
              </small>
            </span>
            <em>▶</em>
          </Link>
        )}

        {(sources?.pastExams ?? []).map((exam) => {
          const isQuotaDepleted = !isPro && freeQuestionsLeft <= 0;
          return (
            <Link
              key={exam._id}
              href={`/app/exam?subject=${subjectSlug}&source=past&exam=${exam._id}`}
              onClick={(e) => {
                if (isQuotaDepleted) {
                  e.preventDefault();
                  setRestrictionModal("questions");
                }
              }}
              className={`stage-row ${isQuotaDepleted ? "opacity-75" : ""}`}
            >
              <span>
                <b>{profile?.language === "am" ? exam.labelAm : exam.labelEn}</b>
                <small>
                  {exam.year} · {exam.durationMinutes}
                  {t.progMinSuffix}
                  {exam.questionCount}
                  {t.progQSuffix}
                  {!isPro ? t.progFreeCap : ""}
                </small>
              </span>
              <em>▶</em>
            </Link>
          );
        })}
        {!sources?.mock.available && !sources?.pastExams.length && (
          <p className="cab p-5 font-mono text-sm text-muted">{t.noQuestions}</p>
        )}
      </div>
    </main>
  );
}
