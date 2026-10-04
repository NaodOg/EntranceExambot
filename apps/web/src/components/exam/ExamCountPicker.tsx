"use client";

import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { ArrowLeft } from "lucide-react";
import { useTelegramId } from "@/hooks/useTelegramId";
import type { Lang } from "@/lib/copy";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import {
  buildExamHref,
  examCountChoices,
  sittingMinutes,
  type QuestionSource,
  type SittingMode,
} from "@/lib/exam-source";

function bankLabel(text: string, lang: Lang) {
  return lang === "en" ? text.toUpperCase() : text;
}

export function ExamCountPicker({
  subjectSlug,
  sitting,
  source,
  examId,
  dailyGoal,
  onBack,
  onPick,
}: {
  subjectSlug: string;
  sitting: SittingMode;
  source: QuestionSource;
  examId?: string | null;
  dailyGoal: number;
  onBack?: () => void;
  onPick: (href: string) => void;
}) {
  const { userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const lang: Lang = profile?.language ?? "en";
  const t = useAppCopy(lang);
  const sources = useQuery(api.exams.listQuestionSources, { subjectSlug });
  const available =
    source === "mock"
      ? sources?.mock.questionCount
      : source === "all"
        ? sources?.all.questionCount
        : sources?.pastExams.find((exam) => exam._id === examId)?.questionCount;
  const choices = examCountChoices(dailyGoal);
  const presets = choices.filter((choice) => !choice.isGoal);
  const goalChoice = choices.find((choice) => choice.isGoal);
  const usable = choices.filter((choice) => available === undefined || choice.count <= available);
  const fallbackCount =
    available && usable.length === 0 ? available : null;

  function choose(count: number) {
    onPick(
      buildExamHref({
        subjectSlug,
        sitting,
        source,
        examId: examId ?? undefined,
        count,
      }),
    );
  }

  return (
    <div className="src-pick-body">
      <div className="flex items-center justify-between gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink"
          >
            <ArrowLeft size={14} /> {t.examBack}
          </button>
        )}
      </div>
      <p className="kicker mt-4">▚ {bankLabel(t.countPickKicker, lang)}</p>
      <h2 className="font-mono mt-2 text-2xl font-bold tracking-wide">
        {bankLabel(t.countPickTitle, lang)}
      </h2>
      <p className="mt-2 text-sm text-muted">{t.countPickBody}</p>
      {available !== undefined && source === "past" && (
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted">
          {t.countPickTooFew.replace("{n}", String(available))}
        </p>
      )}

      {sources === undefined ? (
        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted">
          {t.examLoadingPapers}
        </p>
      ) : (
        <div className="src-count-stack mt-4">
          <div className="src-count-grid">
            {presets.map((choice) => {
              const tooBig = available !== undefined && choice.count > available;
              return (
                <button
                  key={choice.count}
                  type="button"
                  disabled={tooBig}
                  className="src-count-opt"
                  onClick={() => choose(choice.count)}
                >
                  <b>{choice.count}</b>
                  <small>
                    {t.countPickTime.replace("{n}", String(sittingMinutes(choice.count)))}
                  </small>
                </button>
              );
            })}
          </div>
          {goalChoice && (
            <button
              type="button"
              disabled={available !== undefined && goalChoice.count > available}
              className="src-count-opt is-goal"
              onClick={() => choose(goalChoice.count)}
            >
              <b>{goalChoice.count}</b>
              <small>{t.countPickGoal}</small>
            </button>
          )}
          {fallbackCount !== null && (
            <button
              type="button"
              className="src-count-opt is-goal"
              onClick={() => choose(fallbackCount)}
            >
              <b>{fallbackCount}</b>
              <small>{t.countPickAll.replace("{n}", String(fallbackCount))}</small>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
