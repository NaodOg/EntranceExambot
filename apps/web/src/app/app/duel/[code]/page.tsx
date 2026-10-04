"use client";

import { useMutation, useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";
import {
  buildDuelInviteLink,
  buildDuelTelegramShareLink,
} from "@/lib/bot-links";
import { buzz, buzzCombo, buzzError, buzzSuccess, buzzTap, buzzVictory } from "@/lib/feedback";
import { QuestionLedger } from "@/components/questions/QuestionLedger";
import { ExamSkeleton } from "@/components/ui/Skeleton";
import { SeatGrid } from "@/components/duel/SeatGrid";
import { ArrowLeft, Check, Copy, Lock, Share2, Swords } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { RestrictionModal } from "@/components/ui/RestrictionModal";
import { TimeoutModal } from "@/components/exam/TimeoutModal";
import { duelMinutes, duelSeconds } from "@/lib/exam-source";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { fillTemplate } from "@/lib/i18n/merge";

export default function DuelPlayPage() {
  const params = useParams();
  const code = String(params?.code ?? "").toUpperCase();
  const { telegramId, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const duel = useQuery(api.duels.getDuel, telegramId ? { code, telegramId } : "skip");
  const startOfDay = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }, []);
  const duelStats = useQuery(
    api.duels.getMyDuelStats,
    telegramId ? { telegramId, todayStartMs: startOfDay } : "skip",
  );
  const submitDuel = useMutation(api.duels.submitDuelAttempt);
  const joinDuel = useMutation(api.duels.joinDuel);

  const [isPlaying, setIsPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedbackShown, setFeedbackShown] = useState<Record<string, boolean>>({});
  const [instantOn, setInstantOn] = useState(true);
  const [combo, setCombo] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  const joiningRef = useRef(false);
  const joinAttemptedRef = useRef(false);
  const finishingRef = useRef(false);
  const startTimesRef = useRef<Record<string, number>>({});
  const endTimesRef = useRef<Record<string, number>>({});
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const haptics = profile?.hapticsEnabled ?? true;
  const sound = profile?.soundEnabled ?? false;
  const lang = profile?.language ?? "en";
  const t = useAppCopy(lang);

  useEffect(() => {
    if (profile?.instantFeedback !== undefined) {
      setInstantOn(profile.instantFeedback);
    }
  }, [profile?.instantFeedback]);

  const isPro = duelStats?.isPro ?? false;
  const freeQuestionsLeft = duelStats?.freeQuestionsLeft ?? 20;
  const paper = useQuery(
    api.duels.getDuelQuestions,
    isPlaying && telegramId ? { code, telegramId } : "skip",
  );
  const questions = useMemo(() => paper?.questions ?? [], [paper?.questions]);
  const needed = duel?.questionCount ?? 10;
  const canPlay = isPro || freeQuestionsLeft >= needed;
  const current = questions[index];
  const selected = current ? answers[current._id] : undefined;
  const youSeat = duel?.callerId ?? undefined;

  useEffect(() => {
    if (!duel || !telegramId || joiningRef.current || joinAttemptedRef.current) return;
    if (duel.isPlayer || duel.status === "completed" || duel.status === "expired") return;
    if (duel.isFull) return;
    joiningRef.current = true;
    joinAttemptedRef.current = true;
    void joinDuel({
      telegramId,
      code,
      language: lang === "am" ? "am" : "en",
    })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : t.duelCouldNotJoin;
        if (msg.includes("Daily free limit")) {
          setShowRestrictionModal(true);
        } else if (!msg.includes("already closed") && !msg.includes("full")) {
          setJoinError(msg);
        }
      })
      .finally(() => {
        joiningRef.current = false;
      });
  }, [code, duel, joinDuel, lang, t, telegramId]);

  useEffect(() => {
    if (current) {
      startTimesRef.current[current._id] ??= Date.now();
    }
  }, [index, current]);

  useEffect(() => {
    if (questions.length <= 10) return;
    dotRefs.current[index]?.scrollIntoView({
      behavior: profile?.reduceMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [index, profile?.reduceMotion, questions.length]);

  useEffect(() => {
    if (!isPlaying || showTimeout) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, showTimeout]);

  async function finishBattle() {
    if (finishingRef.current || submitting) return;
    finishingRef.current = true;
    setSubmitting(true);
    buzz(haptics, "heavy");

    const payload = questions.map((q) => ({
      questionId: q._id,
      selectedKey: answers[q._id] ?? "",
      timeSec: Math.max(
        1,
        Math.round(
          ((endTimesRef.current[q._id] ?? Date.now()) -
            (startTimesRef.current[q._id] ?? startedAt)) /
            1000,
        ),
      ),
    }));

    try {
      await submitDuel({
        telegramId,
        code,
        answers: payload,
        durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      });
      buzzVictory(haptics, sound);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Daily free limit") || msg.includes("Free accounts are limited")) {
        setShowRestrictionModal(true);
      }
    } finally {
      setIsPlaying(false);
      setSubmitting(false);
      finishingRef.current = false;
    }
  }

  useEffect(() => {
    if (!isPlaying || showTimeout || secondsLeft > 0) return;
    setShowTimeout(true);
    buzzError(haptics, sound);
  }, [isPlaying, secondsLeft, showTimeout, haptics, sound]);

  function handleStartBattle() {
    if (!canPlay) {
      setShowRestrictionModal(true);
      return;
    }
    setIsPlaying(true);
    setStartedAt(Date.now());
    setSecondsLeft(duelSeconds(needed));
    buzz(haptics, "medium");
  }

  async function chooseOption(key: string) {
    if (!current || selected || showTimeout) return;
    setAnswers((prev) => ({ ...prev, [current._id]: key }));
    endTimesRef.current[current._id] = Date.now();
    setFeedbackShown((prev) => ({ ...prev, [current._id]: instantOn }));
    const correct = key === current.correctKey;
    if (correct) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
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

  async function goNext() {
    if (index < questions.length - 1) {
      buzzTap(haptics, sound);
      setIndex((i) => i + 1);
      return;
    }
    await finishBattle();
  }

  const inviteLink = buildDuelInviteLink(code);
  const telegramShareLink = buildDuelTelegramShareLink(
    duel?.subjectName ?? "",
    code,
    {
      questionCount: duel?.questionCount,
      maxPlayers: duel?.maxPlayers,
    },
  );

  function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCopied(false);
      });
  }

  if (duel === undefined || (isPlaying && paper === undefined)) {
    return <ExamSkeleton />;
  }

  if (duel === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <div className="cab p-6 font-mono">
          <p className="kicker">{t.duelError}</p>
          <h1 className="mt-2 text-2xl font-bold">{t.duelNotFound}</h1>
          <p className="mt-2 text-xs text-muted">
            {fillTemplate(t.duelNotFoundBody, { code })}
          </p>
          <Link href="/app/duel" className="btn btn-primary mt-4 w-full">
            {t.duelBackToLobby}
          </Link>
        </div>
      </main>
    );
  }

  if (isPlaying && current) {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, "0");
    const progress = questions.length ? (index + 1) / questions.length : 0;
    return (
      <main className="exam-play mx-auto w-full max-w-lg">
        <TimeoutModal
          open={showTimeout}
          answered={Object.keys(answers).length}
          total={questions.length}
          submitting={submitting}
          onContinue={() => {
            setShowTimeout(false);
            void finishBattle();
          }}
          copy={{
            timeUp: t.timeUp,
            pencilsDown: t.pencilsDown,
            timeUpBody: t.timeUpBody,
            seeResults: t.seeResults,
            posting: t.posting,
          }}
        />
        <div className="exam-play-head">
          <div className="exam-hud">
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="exam-hud-exit"
            >
              {t.duelAbort}
            </button>
            <div className="exam-hud-center">
              <div className={`is-time ${secondsLeft <= 0 ? "is-dead" : secondsLeft <= 10 ? "is-low" : ""}`}>
                {minutes}:{seconds}
              </div>
              {instantOn && combo >= 2 && (
                <div className={`exam-combo-pill ${combo >= 5 ? "is-fire" : ""}`}>
                  <span className="exam-combo-tag">{t.duelCombo}</span>
                  <b className="exam-combo-val">x{combo}</b>
                </div>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={instantOn}
              aria-label={t.duelInstantFeedbackAria}
              disabled={Boolean(selected)}
              onClick={() => {
                buzzTap(haptics, sound);
                setInstantOn((value) => !value);
              }}
              className={`exam-instant-toggle ${instantOn ? "is-on" : ""}`}
            >
              <span className="exam-instant-label">
                {instantOn ? t.duelModeLive : t.duelModeExam}
              </span>
            </button>
          </div>
          <div className="progress-track">
            <motion.div
              className="progress-fill"
              animate={{ scaleX: progress }}
              style={{ scaleX: progress }}
            />
          </div>
        </div>

        <div className="exam-play-scroll">
          <AnimatePresence mode="wait">
            <motion.div
              key={current._id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
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
                reported={false}
                lang={lang}
                instant={Boolean(selected && feedbackShown[current._id])}
                locked
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="exam-play-actions">
          <div
            className={`q-dot-track ${questions.length > 10 ? "is-scroll" : ""}`}
            aria-label={t.duelQuestionNavAria}
          >
            {questions.map((question, questionIndex) => (
              <button
                key={question._id}
                ref={(el) => {
                  dotRefs.current[questionIndex] = el;
                }}
                type="button"
                onClick={() => setIndex(questionIndex)}
                className={`q-dot ${
                  questionIndex === index
                    ? "is-on"
                    : answers[question._id]
                      ? "is-done"
                      : ""
                }`}
                aria-current={questionIndex === index ? "step" : undefined}
                title={fillTemplate(t.duelQuestionN, { n: questionIndex + 1 })}
              >
                {questionIndex + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!selected || submitting || showTimeout}
            onClick={() => void goNext()}
            className="btn btn-primary w-full"
          >
            {submitting
              ? t.duelPostingScore
              : index === questions.length - 1
                ? t.duelLockIn
                : t.duelNextQuestion}
          </button>
        </div>
      </main>
    );
  }

  const hasFinished = duel.hasCallerPlayed;
  const isCompleted = duel.status === "completed";
  const finishedCount = duel.players.filter((player) => player.hasFinished).length;

  return (
    <main className="flex flex-col gap-5 p-4 pt-6 pb-12">
      <RestrictionModal
        open={showRestrictionModal}
        onClose={() => setShowRestrictionModal(false)}
        type="questions"
      />

      <div className="flex items-center justify-between">
        <Link
          href="/app/duel"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> {t.duelLobby}
        </Link>
        <span className="font-mono text-xs tracking-wider text-accent uppercase">
          {fillTemplate(t.duelLobbyLive, {
            a: duel.players.length,
            b: duel.maxPlayers,
          })}
        </span>
      </div>

      <header className="text-center">
        <p className="kicker">
          ▚ {duel.subjectName} ·{" "}
          {fillTemplate(t.duelHeaderMeta, {
            count: duel.questionCount,
            min: duelMinutes(duel.questionCount),
          })}
        </p>
        <h1 className="font-mono mt-1 text-3xl font-bold tracking-wide">
          {fillTemplate(t.duelArenaTitle, { n: duel.maxPlayers })}
        </h1>
      </header>

      <div className="dx-code-face">
        <span className="dx-seat-tag">{t.duelCode}</span>
        <b>{duel.code}</b>
        <span className="dx-seat-meta">{t.duelShareHint}</span>
      </div>

      <SeatGrid
        maxPlayers={duel.maxPlayers}
        players={duel.players}
        youId={youSeat}
        questionCount={duel.questionCount}
        winnerId={duel.winnerId}
      />

      {isCompleted && (
        <div className="cab p-4 text-center">
          <p className="kicker">{t.duelMatchConcluded}</p>
          <h2 className="font-mono mt-1 text-2xl font-bold tracking-wide text-accent">
            {duel.winnerName
              ? fillTemplate(t.duelWinner, { name: duel.winnerName.toUpperCase() })
              : t.duelHonorableDraw}
          </h2>
          <p className="mt-1 text-xs text-muted">{t.duelFirstPlaceXp}</p>
        </div>
      )}

      {!hasFinished && duel.isPlayer ? (
        <div className="cab p-5 text-center flex flex-col gap-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
            {t.duelCabinetHot}
          </span>
          <p className="text-xs text-muted">
            {fillTemplate(t.duelStartBody, {
              questions: duel.questionCount,
              minutes: duelMinutes(duel.questionCount),
            })}
          </p>
          {canPlay ? (
            <button
              type="button"
              onClick={handleStartBattle}
              className="btn btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              <Swords size={18} />{" "}
              {fillTemplate(t.duelStartButton, { n: duel.questionCount })}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowRestrictionModal(true)}
              className="btn btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              <Lock size={16} /> {t.duelFreeLimit}
            </button>
          )}
        </div>
      ) : !hasFinished && !duel.isPlayer ? (
        <div className="cab p-5 text-center">
          <p className="kicker">{duel.isFull ? t.duelLobbyFull : t.duelJoiningRoom}</p>
          <p className="mt-2 text-xs text-muted">
            {duel.isFull ? t.duelLobbyFullBody : joinError || t.duelClaiming}
          </p>
        </div>
      ) : !isCompleted ? (
        <div className="cab p-5 text-center flex flex-col gap-2">
          <span className="kicker">{t.duelScorePosted}</span>
          <h3 className="font-mono text-lg font-bold text-ink">
            {fillTemplate(t.duelFinished, {
              a: finishedCount,
              b: duel.players.length,
            })}
          </h3>
          <p className="text-xs text-muted">{t.duelKeepRoom}</p>
        </div>
      ) : null}

      <div className="cab p-4 flex flex-col gap-3">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
          {t.duelPullMore}
        </span>
        <div className="flex gap-2">
          <a
            href={telegramShareLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary flex flex-1 items-center justify-center gap-2 text-xs"
          >
            <Share2 size={15} /> {t.duelShareTelegram}
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-ghost px-4 flex items-center gap-1.5 text-xs font-mono"
          >
            {copied ? <Check size={14} className="text-sage" /> : <Copy size={14} />}
            {copied ? t.duelCopied : t.duelCopy}
          </button>
        </div>
      </div>
    </main>
  );
}
