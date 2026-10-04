"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { ArrowLeft, Calendar, Layers, Shuffle, X } from "lucide-react";
import { useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";
import { type AppCopy, type Lang } from "@/lib/copy";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import type { QuestionSource, SittingMode } from "@/lib/exam-source";
import { buildExamHref } from "@/lib/exam-source";

function bankLabel(text: string, lang: Lang) {
  return lang === "en" ? text.toUpperCase() : text;
}

type PastExam = {
  _id: string;
  year: number;
  questionCount: number;
  durationMinutes: number;
  labelEn: string;
  labelAm: string;
};

export function ExamSourcePicker({
  subjectSlug,
  sitting,
  open = true,
  onClose,
  onPick,
  variant = "overlay",
}: {
  subjectSlug: string;
  sitting: SittingMode;
  open?: boolean;
  onClose?: () => void;
  onPick?: (href: string) => void;
  variant?: "overlay" | "page";
}) {
  const { userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const lang: Lang = profile?.language ?? "en";
  const t = useAppCopy(lang);
  const sources = useQuery(api.exams.listQuestionSources, { subjectSlug });
  const [step, setStep] = useState<"root" | "past">("root");

  function choose(href: string) {
    onPick?.(href);
    onClose?.();
  }

  const body = (
    <PickerBody
      sitting={sitting}
      subjectSlug={subjectSlug}
      sources={sources}
      step={step}
      lang={lang}
      t={t}
      onStep={setStep}
      onChoose={choose}
      onClose={variant === "overlay" ? onClose : undefined}
    />
  );

  if (variant === "page") {
    return <div className="src-pick-page">{body}</div>;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label={t.examCloseSourcePicker}
            className="absolute inset-0 bg-black/75 cursor-default"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.sourcePick}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="cab relative w-full max-w-md max-h-[90dvh] overflow-y-auto p-5 shadow-2xl"
          >
            {body}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PickerBody({
  sitting,
  subjectSlug,
  sources,
  step,
  lang,
  t,
  onStep,
  onChoose,
  onClose,
}: {
  sitting: SittingMode;
  subjectSlug: string;
  sources:
    | {
        mock: { available: boolean; examCount: number; questionCount: number };
        pastExams: PastExam[];
        all: { available: boolean; examCount: number; questionCount: number };
      }
    | undefined;
  step: "root" | "past";
  lang: Lang;
  t: AppCopy;
  onStep: (step: "root" | "past") => void;
  onChoose: (href: string) => void;
  onClose?: () => void;
}) {
  const title = sitting === "quick" ? t.homeQuick10 : t.homeExam;
  const kicker = sitting === "quick" ? t.homeSub10NoTimer : t.examFullSitting;

  if (sources === undefined) {
    return (
      <div className="src-pick-body">
        <p className="kicker">▚ {kicker}</p>
        <h2 className="font-mono mt-2 text-2xl font-bold tracking-wide">{title}</h2>
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted">
          {t.examLoadingPapers}
        </p>
      </div>
    );
  }

  if (step === "past") {
    return (
      <div className="src-pick-body">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onStep("root")}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink"
          >
            <ArrowLeft size={14} /> {t.examBack}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center border border-line text-muted hover:text-ink hover:border-accent"
              aria-label={t.examClose}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <p className="kicker mt-4">▚ {bankLabel(t.sourcePastKicker, lang)}</p>
        <h2 className="font-mono mt-2 text-2xl font-bold tracking-wide">
          {bankLabel(t.sourcePastTitle, lang)}
        </h2>
        <p className="mt-2 text-sm text-muted">{t.sourcePastBody}</p>
        <div className="mt-4 grid gap-2">
          {sources.pastExams.map((exam) => (
            <button
              key={exam._id}
              type="button"
              className="src-pick-row"
              onClick={() =>
                onChoose(
                  buildExamHref({
                    subjectSlug,
                    sitting,
                    source: "past",
                    examId: exam._id,
                  }),
                )
              }
            >
              <span>
                <b>{lang === "am" ? exam.labelAm : exam.labelEn}</b>
                <small>
                  {sitting === "quick"
                    ? t.examPastQuickMeta.replace("{n}", String(Math.min(10, exam.questionCount)))
                    : t.examPastExamMeta
                        .replace("{n}", String(exam.questionCount))
                        .replace("{m}", String(exam.durationMinutes))}
                </small>
              </span>
              <em>▶</em>
            </button>
          ))}
          {sources.pastExams.length === 0 && (
            <p className="cab p-4 font-mono text-xs text-muted">{t.sourcePastEmpty}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="src-pick-body">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">▚ {kicker}</p>
          <h2 className="font-mono mt-2 text-2xl font-bold tracking-wide">{title}</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center border border-line text-muted hover:text-ink hover:border-accent"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        {sitting === "quick" ? t.sourceBlurbQuick : t.sourceBlurbExam}
      </p>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          disabled={!sources.mock.available}
          className="src-pick-card"
          onClick={() =>
            onChoose(
              buildExamHref({
                subjectSlug,
                sitting,
                source: "mock",
              }),
            )
          }
        >
          <Layers size={18} className="text-accent shrink-0" />
          <span>
            <b>{bankLabel(t.sourceMock, lang)}</b>
            <small>
              {sources.mock.available ? t.sourceMockHint : t.sourceMockEmpty}
            </small>
          </span>
        </button>

        <button
          type="button"
          disabled={sources.pastExams.length === 0}
          className="src-pick-card"
          onClick={() => onStep("past")}
        >
          <Calendar size={18} className="text-accent shrink-0" />
          <span>
            <b>{bankLabel(t.sourcePast, lang)}</b>
            <small>
              {sources.pastExams.length
                ? t.sourcePastHint.replace("{n}", String(sources.pastExams.length))
                : t.sourcePastEmpty}
            </small>
          </span>
        </button>

        <button
          type="button"
          disabled={!sources.all.available}
          className="src-pick-card"
          onClick={() =>
            onChoose(
              buildExamHref({
                subjectSlug,
                sitting,
                source: "all",
              }),
            )
          }
        >
          <Shuffle size={18} className="text-accent shrink-0" />
          <span>
            <b>{bankLabel(t.sourceAll, lang)}</b>
            <small>
              {sources.all.available ? t.sourceAllHint : t.sourceAllEmpty}
            </small>
          </span>
        </button>
      </div>
    </div>
  );
}

export function DuelSourceToggle({
  value,
  onChange,
  sources,
}: {
  value: QuestionSource | null;
  onChange: (source: QuestionSource) => void;
  sources:
    | {
        mock: { available: boolean };
        pastExams: Array<unknown>;
      }
    | undefined;
}) {
  const { userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const lang: Lang = profile?.language ?? "en";
  const t = useAppCopy(lang);
  const mockOn = sources?.mock.available ?? false;
  const pastOn = (sources?.pastExams.length ?? 0) > 0;

  return (
    <div className="src-toggle">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {bankLabel(t.questionBank, lang)}
      </span>
      <div className="src-toggle-row">
        <button
          type="button"
          disabled={!mockOn}
          className={value === "mock" ? "is-on" : undefined}
          onClick={() => onChange("mock")}
        >
          <b>{bankLabel(t.sourceMock, lang)}</b>
          <small>{t.sourceMockHint}</small>
        </button>
        <button
          type="button"
          disabled={!pastOn}
          className={value === "past" ? "is-on" : undefined}
          onClick={() => onChange("past")}
        >
          <b>{bankLabel(t.sourcePast, lang)}</b>
          <small>{t.sourcePastSub}</small>
        </button>
      </div>
    </div>
  );
}
