"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useAuthedQuery, useMutation, useQuery } from "@/lib/authed-convex";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import {
  parseExamCount,
  shuffleCopy,
  sittingMinutes,
  type QuestionSource,
  type SittingMode,
} from "@/lib/exam-source";
import { buzz, buzzCombo, buzzError, buzzSuccess, buzzTap, buzzVictory } from "@/lib/feedback";
import { QuestionLedger } from "@/components/questions/QuestionLedger";
import { ExamCountPicker } from "@/components/exam/ExamCountPicker";
import { ExamSourcePicker } from "@/components/exam/ExamSourcePicker";
import { TimeoutModal } from "@/components/exam/TimeoutModal";
import { Lock } from "lucide-react";
import { RestrictionModal } from "@/components/ui/RestrictionModal";
import { ExamSkeleton } from "@/components/ui/Skeleton";

export default function ExamPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get("subject");
  const mode = searchParams.get("mode");
  const sourceParam = searchParams.get("source");
  const source: QuestionSource | null =
    sourceParam === "mock" || sourceParam === "past" || sourceParam === "all"
      ? sourceParam
      : null;
  const examParam = searchParams.get("exam") as Id<"exams"> | null;
  const sitting: SittingMode = mode === "quick" ? "quick" : "exam";
  const questionCount = sitting === "exam" ? parseExamCount(searchParams.get("count")) : null;
  const needsPicker = mode !== "mistakes" && (!source || (source === "past" && !examParam)) && !examParam;
  const needsCount = mode !== "mistakes" && sitting === "exam" && !needsPicker && questionCount === null;
  const sittingSource: QuestionSource | null = source ?? (examParam ? "past" : null);
  const { telegramId, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  // A link may arrive without a subject (older deep links, Telegram start
  // params). Fall back to the student's saved pick so the sitting still loads.
  const subjectSlug = subjectParam ?? profile?.subjectSlugs?.[0] ?? "";
  const prepareSitting = useMutation(api.exams.prepareSitting);
  const [sourceExamData, setSourceExamData] = useState<{
    hostExamId: Id<"exams">;
    durationMinutes: number;
    titleEn: string;
    questions: Array<{
      _id: Id<"questions">;
      order: number;
      unit: string;
      chapter: string;
      textEn: string;
      textAm: string;
      options: Array<{ key: string; textEn: string; textAm: string }>;
      correctKey: string;
      explanationEn: string;
      explanationAm: string;
      imageUrl: string | null;
    }>;
  } | null | undefined>(undefined);
  const sittingKey = `${subjectSlug}:${source ?? ""}:${examParam ?? ""}:${sitting}:${questionCount ?? ""}`;
  const preparedKey = useRef("");

  useEffect(() => {
    if (mode === "mistakes" || !source || !telegramId) return;
    if (source === "past" && !examParam) return;
    if (sitting === "exam" && questionCount === null) return;
    if (preparedKey.current === sittingKey) return;
    preparedKey.current = sittingKey;
    setSourceExamData(undefined);
    void prepareSitting({
      telegramId,
      subjectSlug,
      source,
      examId: source === "past" ? examParam ?? undefined : undefined,
      mode: sitting,
      questionCount: questionCount ?? undefined,
    })
      .then((paper) => {
        if (preparedKey.current === sittingKey) setSourceExamData(paper);
      })
      .catch(() => {
        if (preparedKey.current === sittingKey) setSourceExamData(null);
      });
  }, [examParam, mode, prepareSitting, questionCount, sitting, sittingKey, source, subjectSlug, telegramId]);

  const regularExamData = useAuthedQuery(
    api.exams.getExamQuestions,
    mode !== "mistakes" && !source && examParam && questionCount !== null
      ? { examId: examParam }
      : "skip",
  );
  const nowMs = useMemo(() => Date.now(), []);
  const mistakeExamData = useQuery(
    api.exams.getMistakeQuiz,
    mode === "mistakes" && telegramId
      ? { telegramId, subjectSlug }
      : "skip",
  );
  const examData = mode === "mistakes" ? mistakeExamData : source ? sourceExamData : regularExamData;
  const mistakeExamId =
    mistakeExamData && "exam" in mistakeExamData ? mistakeExamData.exam?._id : undefined;
  const examId = sourceExamData?.hostExamId ?? mistakeExamId ?? examParam;
  const submitAttempt = useMutation(api.exams.submitAttempt);
  const reportQuestion = useMutation(api.exams.reportQuestion);

  const t = useAppCopy(profile?.language ?? "en");
  const lang = profile?.language ?? "en";
  const haptics = profile?.hapticsEnabled ?? true;
  const sound = profile?.soundEnabled ?? false;
  const [instantOn, setInstantOn] = useState(true);

  useEffect(() => {
    if (profile?.instantFeedback !== undefined) {
      setInstantOn(profile.instantFeedback);
    }
  }, [profile?.instantFeedback]);

  const rawQuestions = examData?.questions ?? [];
  const packKey = `${source ?? "exam"}:${mode ?? "full"}:${examId ?? ""}:${questionCount ?? "all"}:${rawQuestions.length}:${rawQuestions[0]?._id ?? ""}`;
  const [packKeyApplied, setPackKeyApplied] = useState("");
  const [questions, setQuestions] = useState<typeof rawQuestions>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (needsPicker || needsCount || examData === undefined) return;
    if (packKeyApplied === packKey) return;
    const all = rawQuestions;
    if (source) {
      setQuestions(all);
    } else if (mode === "quick") {
      setQuestions(shuffleCopy(all).slice(0, 10));
    } else {
      const limit = questionCount ?? all.length;
      setQuestions(shuffleCopy(all).slice(0, limit));
    }
    setPackKeyApplied(packKey);
    setIndex(0);
  }, [needsPicker, needsCount, examData, packKey, packKeyApplied, rawQuestions, source, mode, questionCount]);

  useEffect(() => {
    if (questions.length > 0 && index >= questions.length) {
      setIndex(0);
    }
  }, [index, questions.length]);

  const [showTimeout, setShowTimeout] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const clockStarted = useRef(false);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const questionScrollRef = useRef<HTMLDivElement | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedbackShown, setFeedbackShown] = useState<Record<string, boolean>>({});
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboBonusXp, setComboBonusXp] = useState(0);
  const [startedAt] = useState(Date.now());
  const startTimesRef = useRef<Record<string, number>>({});
  const endTimesRef = useRef<Record<string, number>>({});
  const untimed = sitting === "quick";
  const paperMinutes =
    sourceExamData?.durationMinutes ??
    (examData && "exam" in examData && examData.exam ? examData.exam.durationMinutes : 10);
  const mockCount =
    questions.length ||
    Math.min(sitting === "exam" ? 100 : 10, rawQuestions.length);
  const durationMinutes = untimed
    ? 0
    : (source === "mock" || source === "all") && mockCount > 0
      ? sittingMinutes(mockCount)
      : paperMinutes;
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [reported, setReported] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState<{
    score: number;
    availableMarks: number;
    correctCount: number;
    total: number;
    xpGain: number;
    bonusXp: number;
    maxCombo: number;
    attemptId: Id<"attempts">;
  } | null>(null);

  const attemptMode: "quick" | "mock" | "mistakes" =
    mode === "mistakes" ? "mistakes" : sitting === "quick" ? "quick" : "mock";

  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const dailyQuota = useQuery(
    api.exams.getDailyQuota,
    telegramId ? { telegramId, todayStartMs: startOfDay } : "skip",
  );

  const isPro = profile?.isProActive || dailyQuota?.isPro || false;
  const freeQuestionsLeft = dailyQuota?.freeQuestionsLeft ?? 20;
  const maxAllowedQuestions = isPro
    ? questions.length
    : Math.min(questions.length, Math.max(0, freeQuestionsLeft));
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dailyExhausted = !isPro && freeQuestionsLeft <= 0;
  const sessionCapReached = !isPro && maxAllowedQuestions < questions.length;

  const current = questions[index];
  const selected = current ? answers[current._id] : undefined;
  const effectiveTotal = maxAllowedQuestions;
  const progress = effectiveTotal ? Math.min(1, (index + 1) / effectiveTotal) : 0;

  useEffect(() => {
    if (current) {
      startTimesRef.current[current._id] ??= Date.now();
    }
    questionScrollRef.current?.scrollTo({
      top: 0,
      behavior: profile?.reduceMotion ? "auto" : "smooth",
    });
  }, [index, profile?.reduceMotion]);

  useEffect(() => {
    if (questions.length <= 10) return;
    dotRefs.current[index]?.scrollIntoView({
      behavior: profile?.reduceMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [index, profile?.reduceMotion, questions.length]);

  useEffect(() => {
    if (untimed || !durationMinutes || finished) return;
    setSecondsLeft(durationMinutes * 60);
    clockStarted.current = true;
  }, [durationMinutes, finished, untimed]);

  useEffect(() => {
    if (untimed || finished || showTimeout) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finished, untimed, showTimeout]);

  useEffect(() => {
    if (!clockStarted.current || untimed || finished || showTimeout) return;
    if (secondsLeft > 0) return;
    setTimedOut(true);
    setShowTimeout(true);
    buzzError(haptics, sound);
  }, [secondsLeft, untimed, finished, showTimeout, haptics, sound]);

  async function chooseOption(key: string) {
    if (!current || selected || timedOut || showTimeout) return;
    const nextAnswers = { ...answers, [current._id]: key };
    setAnswers(nextAnswers);
    endTimesRef.current[current._id] = Date.now();
    setFeedbackShown((prev) => ({ ...prev, [current._id]: instantOn }));

    const correct = key === current.correctKey;
    if (correct) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setMaxCombo((prev) => Math.max(prev, nextCombo));
      const bonus = nextCombo >= 5 ? 10 : nextCombo >= 3 ? 5 : nextCombo >= 2 ? 2 : 0;
      if (bonus > 0) {
        setComboBonusXp((prev) => prev + bonus);
      }
      if (instantOn) {
        if (nextCombo >= 3) {
          buzzCombo(haptics, sound, nextCombo);
        } else {
          buzzSuccess(haptics, sound, nextCombo);
        }
      }
    } else {
      setCombo(0);
      if (instantOn) {
        buzzError(haptics, sound);
      }
    }

  }

  async function finishExam(fromTimeout = false) {
    if (submitting) return;
    setSubmitting(true);
    buzz(haptics, "medium");

    const sitting = questions.slice(0, maxAllowedQuestions);
    const includeBlanks = fromTimeout || timedOut;
    const payload = sitting
      .filter((question) => includeBlanks || answers[question._id])
      .map((question) => ({
        questionId: question._id,
        selectedKey: answers[question._id] ?? "",
        timeSec: Math.max(
          1,
          Math.round(
            ((endTimesRef.current[question._id] ?? Date.now()) -
              (startTimesRef.current[question._id] ?? startedAt)) /
              1000,
          ),
        ),
      }));

    if (!examId) {
      setSubmitting(false);
      return;
    }

    try {
      const result = await submitAttempt({
        telegramId,
        examId,
        mode: attemptMode,
        answers: payload,
        durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        bonusXp: comboBonusXp,
        maxCombo,
      });

      buzzVictory(haptics, sound);

      setFinished({
        score: result.score,
        availableMarks: result.availableMarks,
        correctCount: result.correctCount,
        total: result.totalQuestions,
        xpGain: result.xpGain,
        bonusXp: result.bonusXp ?? comboBonusXp,
        maxCombo,
        attemptId: result.attemptId,
      });
    } catch (err) {
      buzzError(haptics, sound);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Daily free limit reached")) {
        setShowQuotaModal(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function goNext() {
    if (index < maxAllowedQuestions - 1) {
      buzzTap(haptics, sound);
      setIndex((value) => value + 1);
      return;
    }

    await finishExam();
  }

  if (needsPicker) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 p-4 pt-6">
        <Link href="/app" className="font-mono text-xs uppercase tracking-wider text-muted">
          ← {t.backHome}
        </Link>
        <div className="cab p-5">
          <ExamSourcePicker
            subjectSlug={subjectSlug}
            sitting={sitting}
            variant="page"
            onPick={(href) => router.replace(href)}
          />
        </div>
      </main>
    );
  }

  if (needsCount && sittingSource) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 p-4 pt-6">
        <Link href="/app" className="font-mono text-xs uppercase tracking-wider text-muted">
          ← {t.backHome}
        </Link>
        <div className="cab p-5">
          <ExamCountPicker
            subjectSlug={subjectSlug}
            sitting={sitting}
            source={sittingSource}
            examId={examParam}
            dailyGoal={profile?.dailyGoal ?? 20}
            onBack={() => router.replace(`/app/exam?subject=${subjectSlug}`)}
            onPick={(href) => router.replace(href)}
          />
        </div>
      </main>
    );
  }

  if (mode === "mistakes" && mistakeExamData && !mistakeExamData.isPro) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 p-4 text-center">
        <RestrictionModal
          open={true}
          onClose={() => { window.location.href = "/app"; }}
          type="mistakes"
        />
        <div className="cab p-6 text-center">
          <p className="kicker">{t.examMistakesLockedKicker}</p>
          <h1 className="font-mono mt-3 text-2xl font-bold tracking-wide">{t.examMistakeBankDrill}</h1>
          <p className="mt-2 text-sm text-muted">{t.examMistakeDrillDesc}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link href="/app/pro" className="btn btn-primary w-full">
              {t.examGoPro}
            </Link>
            <Link href="/app/mistakes" className="btn btn-ghost w-full">
              {t.examViewMistakesList}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (dailyQuota !== undefined && !isPro && freeQuestionsLeft <= 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 p-4 text-center">
        <RestrictionModal
          open={true}
          onClose={() => { window.location.href = "/app"; }}
          type="questions"
          customTitle={t.examQuotaCompleted}
          customMessage={t.examQuotaModalBody}
        />
        <div className="cab p-6 text-center">
          <p className="kicker">{t.examDailyLimitKicker}</p>
          <h1 className="font-mono mt-3 text-2xl font-bold tracking-wide">{t.examQuotaUsed}</h1>
          <p className="mt-2 text-sm text-muted">{t.examQuotaBody}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowQuotaModal(true)}
              className="btn btn-primary w-full"
            >
              {t.examGoPro}
            </button>
            <Link href="/app" className="btn btn-ghost w-full">
              {t.examBackToArcade}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (examData === undefined || (rawQuestions.length > 0 && packKeyApplied !== packKey)) {
    return <ExamSkeleton />;
  }

  if (!questions.length) {
    return (
      <main className="flex min-h-dvh flex-col gap-4 p-4">
        <Link href="/app" className="font-mono text-xs uppercase tracking-wider text-muted">
          ← {t.backHome}
        </Link>
        <p className="cab p-5 font-mono text-sm text-muted">{t.noQuestions}</p>
      </main>
    );
  }

  if (finished) {
    // Papers weight their questions, so the headline figure is the mark out of
    // the marks available, with the question tally kept as a secondary line.
    const marksAvailable = finished.availableMarks || finished.total;
    const percent = marksAvailable
      ? Math.round((finished.score / marksAvailable) * 100)
      : 0;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-5 p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="cab w-full p-6 text-center"
        >
          <p className="kicker">
            {timedOut ? t.timeUp : percent >= 50 ? t.examStageClear : t.examGameOver}
          </p>
          <div className="font-mono mt-3 text-6xl font-bold tracking-tight">{percent}%</div>
          <div className="mt-3 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider text-muted">
            <span>
              {finished.score}/{marksAvailable}
            </span>
            <span>·</span>
            <span>
              {finished.correctCount}/{finished.total}
            </span>
            <span>·</span>
            <span>+{finished.xpGain} XP</span>
            {finished.bonusXp > 0 && (
              <span className="text-accent font-semibold">
                {t.examComboBonus.replace("{n}", String(finished.bonusXp))}
              </span>
            )}
            {finished.maxCombo >= 2 && (
              <>
                <span>·</span>
                <span className="text-accent font-semibold">
                  {t.examMaxCombo.replace("{n}", String(finished.maxCombo))}
                </span>
              </>
            )}
          </div>
        </motion.div>
        <Link href={`/app/review?attempt=${finished.attemptId}`} className="btn btn-primary w-full">
          {t.review}
        </Link>
        <Link href="/app" className="btn btn-ghost w-full">
          {t.backHome}
        </Link>
      </main>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <main className="mx-auto flex h-dvh min-h-0 w-full max-w-lg flex-col gap-3 overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <TimeoutModal
        open={showTimeout}
        answered={Object.keys(answers).length}
        total={maxAllowedQuestions || questions.length}
        submitting={submitting}
        onContinue={() => {
          setShowTimeout(false);
          void finishExam(true);
        }}
        copy={{
          timeUp: t.timeUp,
          pencilsDown: t.pencilsDown,
          timeUpBody: t.timeUpBody,
          seeResults: t.seeResults,
          posting: t.posting,
        }}
      />
      <div className="exam-hud">
        <Link href="/app" className="exam-hud-exit">
          {t.examExit}
        </Link>
        <div className="exam-hud-center">
          <div
            className={`is-time ${
              untimed ? "is-untimed" : secondsLeft <= 0 ? "is-dead" : secondsLeft <= 10 ? "is-low" : ""
            }`}
          >
            {untimed ? t.examNoTimer : `${minutes}:${seconds}`}
          </div>
          {instantOn && combo >= 2 && (
            <div className={`exam-combo-pill ${combo >= 5 ? "is-fire" : ""}`}>
              <span className="exam-combo-tag">{t.examCombo}</span>
              <b className="exam-combo-val">x{combo}</b>
            </div>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={instantOn}
          aria-label={t.instant}
          disabled={Boolean(selected)}
          onClick={() => {
            buzzTap(haptics, sound);
            setInstantOn((value) => !value);
          }}
          className={`exam-instant-toggle ${instantOn ? "is-on" : ""}`}
        >
          <span className="exam-instant-label">
            {instantOn ? t.examInstantLive : t.examInstantExam}
          </span>
        </button>
      </div>

      {dailyExhausted && (
        <RestrictionModal
          open={showQuotaModal}
          onClose={() => setShowQuotaModal(false)}
          type="questions"
          customTitle={t.examQuotaCompleted}
          customMessage={t.examQuotaModalBody}
        />
      )}

      <div className="progress-track">
        <motion.div className="progress-fill" animate={{ scaleX: progress }} style={{ scaleX: progress }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          ref={questionScrollRef}
          key={current._id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 pr-1 [scrollbar-gutter:stable]"
        >
          <QuestionLedger
            question={{
              unit: current.unit,
              chapter: current.chapter,
              textEn: current.textEn,
              textAm: current.textAm,
              options: current.options,
              correctKey: current.correctKey,
              explanationEn: current.explanationEn,
              explanationAm: current.explanationAm,
              imageUrl: current.imageUrl,
            }}
            selected={selected}
            onSelect={(key) => void chooseOption(key)}
            onReport={(reason) => {
              reportQuestion({ telegramId, questionId: current._id, reason })
                .then(() => {
                  setReported((prev) => ({ ...prev, [current._id]: true }));
                })
                .catch(() => {
                  /* ignore report failures */
                });
            }}
            reported={reported[current._id]}
            lang={lang}
            instant={Boolean(selected && feedbackShown[current._id])}
            locked
          />
        </motion.div>
      </AnimatePresence>

      <div className="shrink-0 space-y-3 border-t border-line bg-bg pt-3">
        <div
          className={`q-dot-track ${questions.length > 10 ? "is-scroll" : ""}`}
          aria-label={t.examQuestionNav}
        >
          {questions.map((question, questionIndex) => {
            const isLocked = !isPro && questionIndex >= maxAllowedQuestions;
            return (
              <button
                key={question._id}
                ref={(el) => {
                  dotRefs.current[questionIndex] = el;
                }}
                type="button"
                onClick={() => {
                  if (isLocked) return;
                  setIndex(questionIndex);
                }}
                className={`q-dot ${
                  questionIndex === index
                    ? "is-on"
                    : answers[question._id]
                      ? "is-done"
                      : isLocked
                        ? "opacity-40 border-dashed"
                        : ""
                }`}
                aria-current={questionIndex === index ? "step" : undefined}
                title={
                  isLocked
                    ? t.examFreePlanSubmitAfter.replace("{n}", String(maxAllowedQuestions))
                    : t.examQuestionTitle.replace("{n}", String(questionIndex + 1))
                }
              >
                {isLocked ? <Lock size={9} className="mx-auto" /> : questionIndex + 1}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!selected || submitting || timedOut || showTimeout}
          onClick={() => void goNext()}
          className="btn btn-primary w-full"
        >
          {index >= maxAllowedQuestions - 1
            ? sessionCapReached && !dailyExhausted
              ? t.examFinishQ.replace("{n}", String(Object.keys(answers).length))
              : t.examFinish
            : t.next}
        </button>
      </div>
    </main>
  );
}
