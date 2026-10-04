"use client";

import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useSubjectSelection } from "@/hooks/useSubjectSelection";
import { SubjectPicker } from "@/components/subject/SubjectPicker";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { ArrowLeft, Check, Lock, Play, Sparkles, X } from "lucide-react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { RestrictionModal } from "@/components/ui/RestrictionModal";

export default function MistakesPage() {
  const { telegramId, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const { subjects, slug: subjectSlug, subject, selectSubject } =
    useSubjectSelection();

  const [mistakeLimit, setMistakeLimit] = useState(20);
  const nowMs = useMemo(() => Date.now(), []);
  const mistakesData = useQuery(
    api.exams.listMistakes,
    telegramId
      ? { telegramId, subjectSlug: subjectSlug ?? "", limit: mistakeLimit }
      : "skip",
  );

  const t = useAppCopy(profile?.language ?? "en");
  const isPro = profile?.isProActive ?? false;
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);

  if (mistakesData === undefined) {
    return <PageSkeleton />;
  }

  return (
    <main className="flex flex-col gap-5 p-4 pt-6 pb-12">
      <RestrictionModal
        open={showRestrictionModal}
        onClose={() => setShowRestrictionModal(false)}
        type="mistakes"
      />

      <div className="flex items-center justify-between">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> {t.progBack}
        </Link>
        <span className="font-mono text-xs tracking-wider text-muted uppercase">
          {subject?.nameEn ?? "—"}
        </span>
      </div>

      <SubjectPicker
        subjects={subjects}
        value={subjectSlug}
        onChange={selectSubject}
        label={t.subjectLabel}
        emptyLabel={t.subjectEmptyForTrack}
      />

      <header>
        <p className="kicker">{t.progErrorLog}</p>
        <h1 className="font-mono mt-1 text-3xl font-bold tracking-wide">
          {t.progMistakeBank}
        </h1>
        <p className="mt-1 text-sm text-muted">{t.progMistakeBankBlurb}</p>
      </header>

      {/* Stats Counter HUD */}
      <div className="cab grid grid-cols-3 gap-2 p-3 text-center">
        <div>
          <span className="block font-mono text-[10px] tracking-widest text-muted uppercase">
            {t.progTotalLogged}
          </span>
          <b className="font-mono text-xl text-ink">
            {mistakesData?.totalCount ?? 0}
          </b>
        </div>
        <div className="border-x border-line">
          <span className="block font-mono text-[10px] tracking-widest text-danger uppercase">
            {t.progUnresolved}
          </span>
          <b className="font-mono text-xl text-danger">
            {mistakesData?.unmasteredCount ?? 0}
          </b>
        </div>
        <div>
          <span className="block font-mono text-[10px] tracking-widest text-sage uppercase">
            {t.progMastered}
          </span>
          <b className="font-mono text-xl text-sage">
            {mistakesData?.masteredCount ?? 0}
          </b>
        </div>
      </div>

      {/* Action Banner: Take Quiz from Mistake Bank (Pro Only) */}
      <div className="cab p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-accent">
              <Sparkles size={13} />
              <span>{t.progDrillMode}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {isPro ? t.progDrillProDesc : t.progDrillLockedDesc}
            </p>
          </div>
        </div>

        <div className="mt-3">
          {isPro ? (
            (mistakesData?.unmasteredCount ?? 0) > 0 ? (
              <Link
                href={`/app/exam?mode=mistakes&subject=${subjectSlug}`}
                className="btn btn-primary flex w-full items-center justify-center gap-2"
              >
                <Play size={14} />{" "}
                {t.progStartDrill.replace(
                  "{n}",
                  String(mistakesData?.unmasteredCount ?? 0),
                )}
              </Link>
            ) : (
              <p className="border border-line p-2 text-center font-mono text-xs text-muted">
                {t.progNoUnresolved}
              </p>
            )
          ) : (
            <button
              type="button"
              onClick={() => setShowRestrictionModal(true)}
              className="btn btn-primary flex w-full items-center justify-center gap-2"
            >
              <Lock size={14} /> {t.progUnlockQuiz}
            </button>
          )}
        </div>
      </div>

      {/* Mistake Items List OR Locked Pro Wall */}
      {!isPro ? (
        <div className="cab p-6 text-center border border-accent/30 bg-surface-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
            <Lock size={22} />
          </div>
          <p className="kicker mt-4">{t.progProVaultLocked}</p>
          <h2 className="font-mono mt-2 text-xl font-bold tracking-wide">
            {t.progHistoryLocked}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-xs text-muted leading-relaxed">
            {t.progHistoryLockedDesc}
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowRestrictionModal(true)}
              className="btn btn-primary w-full"
            >
              {t.progInsertCoinMistakes}
            </button>
            <Link href="/app" className="btn btn-ghost w-full">
              {t.progReturnArcade}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <span className="font-mono text-xs font-semibold tracking-wider text-muted uppercase">
            {t.progVaultCount.replace("{n}", String(mistakesData?.items.length ?? 0))}
          </span>

          {mistakesData?.items.map((item, idx) => {
            if (!item.question) return null;
            const q = item.question;
            const text = q.textEn;
            const explanation = q.explanationEn;

            return (
              <div key={`${item.questionId}-${idx}`} className="cab p-4">
                <div className="flex items-center justify-between gap-2 border-b border-line pb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                  <span>
                    {q.chapter || q.unit} · {item.examTitle}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      item.mastered ? "text-sage" : "text-danger"
                    }`}
                  >
                    {item.mastered ? (
                      <>
                        <Check size={12} /> {t.progMastered}
                      </>
                    ) : (
                      <>
                        <X size={12} />{" "}
                        {t.progMissedCount.replace("{n}", String(item.wrongCount))}
                      </>
                    )}
                  </span>
                </div>

                <p className="mt-3 text-sm font-medium leading-relaxed text-ink">
                  {text}
                </p>

                <div className="mt-3 grid gap-1.5">
                  {q.options.map((opt) => {
                    const isCorrect = opt.key === q.correctKey;
                    const optText = opt.textEn;
                    return (
                      <div
                        key={opt.key}
                        className={`flex items-start gap-2 border p-2 text-xs ${
                          isCorrect
                            ? "border-sage/40 bg-sage/10 text-sage"
                            : "border-line text-muted"
                        }`}
                      >
                        <b className="font-mono">{opt.key}.</b>
                        <span>{optText}</span>
                        {isCorrect && (
                          <Check size={13} className="ml-auto shrink-0 text-sage" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {explanation && (
                  <div className="mt-3 border-t border-dashed border-line pt-2 text-xs text-muted">
                    <b className="font-mono text-[10px] uppercase text-accent">{t.progExplanation}</b>
                    <span>{explanation}</span>
                  </div>
                )}
              </div>
            );
          })}

          {mistakesData?.hasMore && (
            <button
              type="button"
              onClick={() => setMistakeLimit((value) => value + 20)}
              className="btn btn-ghost w-full"
            >
              {t.showMore}
            </button>
          )}

          {mistakesData && mistakesData.items.length === 0 && (
            <div className="cab p-8 text-center font-mono text-sm text-muted">
              {t.progNoRecorded}
              <p className="mt-1 text-xs">{t.progNoRecordedDesc}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
