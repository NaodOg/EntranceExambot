"use client";

import { useMutation, useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useSubjectSelection } from "@/hooks/useSubjectSelection";
import { SubjectPicker } from "@/components/subject/SubjectPicker";
import { ArrowLeft, Lock, Zap } from "lucide-react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { RestrictionModal } from "@/components/ui/RestrictionModal";
import { ArcadeDial } from "@/components/duel/ArcadeDial";
import { DuelSourceToggle } from "@/components/exam/ExamSourcePicker";
import { buzzTap } from "@/lib/feedback";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { fillTemplate } from "@/lib/i18n/merge";
import { duelMinutes, type QuestionSource } from "@/lib/exam-source";

export default function DuelLobbyPage() {
  const router = useRouter();
  const { telegramId, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const { subjects, slug: subjectSlug, subject, selectSubject } =
    useSubjectSelection();
  const startOfDay = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }, []);
  const duelStats = useQuery(
    api.duels.getMyDuelStats,
    telegramId ? { telegramId, todayStartMs: startOfDay } : "skip",
  );
  const [duelLimit, setDuelLimit] = useState(5);
  const myDuels = useQuery(
    api.duels.listMyDuels,
    userArg === "skip" ? "skip" : { ...userArg, limit: duelLimit },
  );
  const createDuelMutation = useMutation(api.duels.createDuel);

  const questionSources = useQuery(
    api.exams.listQuestionSources,
    subjectSlug ? { subjectSlug } : "skip",
  );
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [questionCount, setQuestionCount] = useState(10);
  const [source, setSource] = useState<QuestionSource | null>(null);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("source");
    if (param === "mock" || param === "past") setSource(param);
  }, []);

  useEffect(() => {
    if (source || !questionSources) return;
    if (questionSources.mock.available) setSource("mock");
    else if (questionSources.pastExams.length > 0) setSource("past");
  }, [questionSources, source]);

  const isPro = duelStats?.isPro ?? false;
  const freeQuestionsLeft = duelStats?.freeQuestionsLeft ?? 20;
  const questionMax = isPro ? 100 : Math.max(1, Math.min(20, freeQuestionsLeft));
  const safeQuestionCount = Math.min(questionCount, questionMax);
  const canPlay = isPro || freeQuestionsLeft > 0;
  const canCreate = isPro || freeQuestionsLeft >= 1;
  const timerMin = duelMinutes(safeQuestionCount);
  const haptics = profile?.hapticsEnabled ?? true;
  const t = useAppCopy(profile?.language ?? "en");

  if (duelStats === undefined || myDuels === undefined) {
    return <PageSkeleton />;
  }

  async function handleCreateDuel() {
    if (!canCreate) {
      setShowRestrictionModal(true);
      return;
    }
    if (!source) {
      setErrorMsg(t.sourceNeedPick);
      return;
    }

    setCreating(true);
    setErrorMsg("");
    try {
      const res = await createDuelMutation({
        telegramId,
        subjectSlug: subjectSlug ?? "",
        questionCount: safeQuestionCount,
        maxPlayers,
        source,
      });
      router.push(`/app/duel/${res.code}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.duelCreateFailed;
      if (msg.includes("Daily free limit") || msg.includes("Free accounts are limited")) {
        setShowRestrictionModal(true);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setCreating(false);
    }
  }

  function handleJoin() {
    const clean = joinCode.trim().toUpperCase();
    if (!clean) return;
    if (!canPlay) {
      setShowRestrictionModal(true);
      return;
    }
    router.push(`/app/duel/${clean}`);
  }

  return (
    <main className="flex flex-col gap-5 p-4 pt-6 pb-12">
      <RestrictionModal
        open={showRestrictionModal}
        onClose={() => setShowRestrictionModal(false)}
        type="questions"
      />

      <div className="flex items-center justify-between">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> {t.duelBack}
        </Link>
        <span
          className={`font-mono text-xs tracking-wider uppercase ${
            isPro ? "text-sage" : "text-accent"
          }`}
        >
          {isPro
            ? t.duelProUnlimited
            : fillTemplate(t.duelFreeLeft, { left: Math.max(0, freeQuestionsLeft) })}
        </span>
      </div>

      <header>
        <p className="kicker">{t.duelCustomArena}</p>
        <h1 className="font-mono mt-1 text-3xl font-bold tracking-wide">
          {t.duelTitle}
        </h1>
        <p className="mt-1 text-sm text-muted">{t.duelDescription}</p>
      </header>

      <section className="cab p-4 dx-studio">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
          {t.duelBuildMatch}
        </span>

        <div className="border-b border-line pb-2">
          <SubjectPicker
            subjects={subjects}
            value={subjectSlug}
            onChange={selectSubject}
            label={t.duelSubject}
            emptyLabel={t.subjectEmptyForTrack}
          />
        </div>

        <DuelSourceToggle value={source} onChange={setSource} sources={questionSources} />

        <div className="dx-dials">
          <ArcadeDial
            label={t.duelPlayers}
            value={maxPlayers}
            min={2}
            max={10}
            step={1}
            unit={t.duelUnitP}
            presets={[2, 4, 6, 10]}
            onChange={(next) => {
              setMaxPlayers(next);
              buzzTap(haptics, false);
            }}
          />
          <ArcadeDial
            label={t.duelQuestions}
            value={safeQuestionCount}
            min={questionMax >= 5 ? 5 : 1}
            max={questionMax}
            step={5}
            unit={t.duelUnitQ}
            presets={isPro ? [10, 25, 50, 100] : [5, 10, 15, 20].filter((n) => n <= questionMax)}
            onChange={(next) => {
              setQuestionCount(next);
              buzzTap(haptics, false);
            }}
          />
        </div>

        <p className="dx-readout">
          <span>{maxPlayers}{t.duelUnitP}</span>
          <span>{safeQuestionCount}{t.duelUnitQ}</span>
          <span>{fillTemplate(t.duelTildeMin, { n: timerMin })}</span>
        </p>

        {errorMsg && (
          <p className="font-mono text-xs text-danger uppercase">{errorMsg}</p>
        )}

        {canCreate ? (
          <button
            type="button"
            disabled={creating || !source}
            onClick={() => void handleCreateDuel()}
            className="btn btn-primary flex w-full items-center justify-center gap-2"
          >
            <Zap size={16} />
            {creating
              ? t.duelStarting
              : fillTemplate(t.duelStart, {
                  players: maxPlayers,
                  questions: safeQuestionCount,
                })}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowRestrictionModal(true)}
            className="btn btn-primary flex w-full items-center justify-center gap-2"
          >
            <Lock size={14} /> {t.duelFreeLimit}
          </button>
        )}
      </section>

      <div className="cab p-4 flex flex-col gap-2.5">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
          {t.duelJoinWithCode}
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t.duelEnterCode}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="field flex-1 uppercase font-mono tracking-widest text-center"
            maxLength={8}
          />
          <button
            type="button"
            disabled={!joinCode.trim()}
            onClick={handleJoin}
            className="btn btn-ghost px-4 font-mono text-xs uppercase"
          >
            {t.duelEnter}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-xs font-semibold tracking-wider text-muted uppercase">
          {t.duelLog}{myDuels.items.length}{myDuels.hasMore ? "+" : ""})
        </span>

        {myDuels.items.map((duel) => {
          const outcomeColor =
            duel.outcome === "won"
              ? "text-sage border-sage/40 bg-sage/10"
              : duel.outcome === "lost"
                ? "text-danger border-danger/40 bg-danger/10"
                : duel.outcome === "tied"
                  ? "text-muted border-line bg-surface-2"
                  : "text-accent border-accent/40 bg-accent/10";

          return (
            <Link
              key={duel._id}
              href={`/app/duel/${duel.code}`}
              className="cab p-3 flex items-center justify-between gap-3 hover:border-accent transition-colors"
            >
              <div>
                <div className="font-mono text-xs font-bold">
                  {duel.playerNames.slice(0, 3).join(" · ")}
                  {duel.playerNames.length > 3 ? ` +${duel.playerNames.length - 3}` : ""}
                </div>
                <span className="font-mono text-[10px] text-muted tracking-wider uppercase">
                  {fillTemplate(t.duelLogMeta, {
                    a: duel.playerCount,
                    b: duel.maxPlayers,
                    c: duel.questionCount,
                    code: duel.code,
                  })}
                </span>
              </div>
              <div
                className={`border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${outcomeColor}`}
              >
                {duel.outcome === "won"
                  ? t.duelVictory
                  : duel.outcome === "lost"
                    ? t.duelDefeat
                    : duel.outcome === "tied"
                      ? t.duelDraw
                      : duel.outcome === "pending_my_turn"
                        ? t.duelPlayNow
                        : t.duelWaiting}
              </div>
            </Link>
          );
        })}

        {myDuels.hasMore && (
          <button
            type="button"
            onClick={() => setDuelLimit((value) => value + 5)}
            className="btn btn-ghost w-full"
          >
            {t.seeMore}
          </button>
        )}

        {myDuels.items.length === 0 && (
          <div className="cab p-6 text-center font-mono text-xs text-muted">
            {t.duelNoDuels}
            <p className="mt-1">{t.duelNoDuelsHint}</p>
          </div>
        )}
      </div>
    </main>
  );
}
