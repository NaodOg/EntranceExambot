"use client";

import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { createElement, useEffect, useMemo, useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { getTrackIcon } from "@/lib/trackIcon";

function TrackIcon({
  slug,
  size,
  strokeWidth,
}: {
  slug: string;
  size: number;
  strokeWidth?: number;
}) {
  return createElement(getTrackIcon(slug), { size, strokeWidth });
}
import {
  periodRangeLabel,
  periodWindow,
  type LeaderboardPeriod,
} from "@/lib/leaderboardPeriod";
import { Segmented } from "@/components/ui/controls";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ArrowLeft, Check, ChevronDown, Flame, Trophy } from "lucide-react";

export default function LeaderboardPage() {
  const { telegramId, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const tracks = useQuery(api.exams.listPublishedTracks);
  const defaultDept = profile?.trackSlug ?? "computer-science";
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [period, setPeriod] = useState<LeaderboardPeriod>("biweekly");
  const [deptOpen, setDeptOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const activeDept = selectedDept || defaultDept;
  const language = profile?.language ?? "en";
  const t = useAppCopy(language);
  const window = periodWindow(period, nowMs ?? 0);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  const currentTrack = tracks?.find((row) => row.slug === activeDept);
  const deptName =
    language === "am"
      ? currentTrack?.nameAm ?? currentTrack?.nameEn ?? activeDept
      : currentTrack?.nameEn ?? activeDept;
  const blurb =
    period === "biweekly"
      ? t.boardBlurbBiweekly
      : period === "monthly"
        ? t.boardBlurbMonthly
        : t.boardBlurbAll;

  const leaderboard = useQuery(
    api.users.getTrackLeaderboard,
    nowMs == null
      ? "skip"
      : {
          trackSlug: activeDept,
          telegramId: telegramId || undefined,
          period,
          windowStartMs: period === "all_time" ? undefined : window.startMs,
        },
  );

  const rangeLabel = useMemo(
    () => (nowMs == null ? "" : periodRangeLabel(period, nowMs)),
    [period, nowMs],
  );

  if (nowMs == null || leaderboard === undefined) {
    return <PageSkeleton />;
  }

  return (
    <main className="flex flex-col gap-5 p-4 pt-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> {t.progBack}
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          {rangeLabel}
        </span>
      </div>

      <header>
        <p className="kicker">▚ {t.hallOfFame.toUpperCase()}</p>
        <h1 className="font-mono mt-1 flex items-center gap-2 text-3xl font-bold tracking-wide">
          <Trophy size={26} className="text-accent" />
          {t.scoreboard.toUpperCase()}
        </h1>
        <p className="mt-1 text-sm text-muted">{blurb.replace("{track}", deptName)}</p>
      </header>

      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { id: "biweekly", label: t.periodBiweekly },
          { id: "monthly", label: t.periodMonthly },
          { id: "all_time", label: t.periodAllTime },
        ]}
      />

      <section className="grid gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {t.changeTrack}
        </span>
        <button
          type="button"
          aria-expanded={deptOpen}
          aria-controls="faculty-grid"
          onClick={() => setDeptOpen((open) => !open)}
          className="cab flex min-h-14 w-full items-center gap-3 p-3 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center border border-accent bg-accent/15 text-accent">
            <TrackIcon slug={activeDept} size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="font-mono block truncate text-sm tracking-wide text-ink">
              {currentTrack?.nameEn ?? activeDept}
            </b>
            <span className="block truncate text-xs text-muted">
              {currentTrack?.nameAm ? `${currentTrack.nameAm} · ` : ""}
              {activeDept === profile?.trackSlug ? t.yourTrack : t.changeTrack}
              {currentTrack?.examCount
                ? ` · ${currentTrack.examCount} ${t.progExamsSuffix}`
                : ""}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted transition-transform duration-200 ${deptOpen ? "rotate-180" : ""}`}
          />
        </button>

        {deptOpen && tracks && tracks.length > 0 && (
          <div id="faculty-grid" className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
            {tracks.map((dept) => {
              const selected = activeDept === dept.slug;
              const label = language === "am" ? dept.nameAm || dept.nameEn : dept.nameEn;
              return (
                <button
                  key={dept._id}
                  type="button"
                  onClick={() => {
                    setSelectedDept(dept.slug);
                    setDeptOpen(false);
                  }}
                  className={`cab flex min-h-14 items-start gap-2 p-2.5 text-left transition-colors ${
                    selected
                      ? "border-accent bg-accent/10 ring-1 ring-accent"
                      : "hover:border-line-strong hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center border ${
                      selected
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line bg-surface-2 text-muted"
                    }`}
                  >
                    {selected ? <Check size={14} strokeWidth={3} /> : <TrackIcon slug={dept.slug} size={14} />}
                  </span>
                  <span className="min-w-0">
                    <b className="font-mono block truncate text-[11px] tracking-wide text-ink">
                      {label}
                    </b>
                    {dept.nameAm && language !== "am" && (
                      <span className="block truncate text-[10px] text-muted">{dept.nameAm}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {leaderboard.userRank ? (
        <div className="cab flex items-center justify-between p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-accent bg-accent/20 font-mono text-sm font-bold text-accent">
              #{leaderboard.userRank}
            </div>
            <div>
              <span className="block font-mono text-[10px] tracking-widest text-muted uppercase">
                {t.yourStanding}
              </span>
              <b className="font-mono text-sm tracking-wide text-ink">
                #{leaderboard.userRank} / {t.progTop50}
              </b>
            </div>
          </div>
          <div className="text-right font-mono text-xs text-muted">
            <span className="font-semibold text-accent">
              {leaderboard.userXp.toLocaleString()} {t.xp}
            </span>
            <span className="block text-[10px]">
              {profile?.streakCount ?? 0}
              {t.progStreakUnit} {t.streak.toLowerCase()}
            </span>
          </div>
        </div>
      ) : period !== "all_time" ? (
        <div className="cab border-dashed p-3.5 font-mono text-xs text-muted">
          {t.unrankedPeriod}
        </div>
      ) : null}

      <div className="cab overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-line bg-surface-2/60 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
          <span className="w-8 text-center">#</span>
          <span>{t.progOperator}</span>
          <span className="text-right">{t.streak}</span>
          <span className="text-right">{t.xp}</span>
        </div>

        <div className="divide-y divide-line">
          {leaderboard.top50.map((entry) => {
            const isTop3 = entry.rank <= 3;
            const rankSymbol =
              entry.rank === 1
                ? "1"
                : entry.rank === 2
                  ? "2"
                  : entry.rank === 3
                    ? "3"
                    : String(entry.rank).padStart(2, "0");

            return (
              <div
                key={`${entry.rank}-${entry.username ?? entry.name}`}
                className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-3 py-2.5 font-mono text-xs transition-colors ${
                  entry.isCurrentUser
                    ? "border-l-2 border-l-accent bg-accent/15 text-ink"
                    : isTop3
                      ? "bg-accent/5"
                      : "hover:bg-surface-2/40"
                }`}
              >
                <div
                  className={`w-8 text-center font-bold ${
                    isTop3 ? "text-accent" : "text-muted"
                  }`}
                >
                  {isTop3 ? (
                    <span className="inline-flex items-center justify-center gap-0.5">
                      <Trophy size={11} />
                      {rankSymbol}
                    </span>
                  ) : (
                    rankSymbol
                  )}
                </div>

                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-semibold tracking-wide">
                    {entry.name.toUpperCase()}
                  </span>
                  {entry.isPro && (
                    <span className="shrink-0 border border-accent/60 bg-accent/20 px-1 text-[9px] font-bold text-accent">
                      {t.pro.toUpperCase()}
                    </span>
                  )}
                  {entry.isCurrentUser && (
                    <span className="shrink-0 text-[9px] font-bold text-accent">
                      ({t.progYou})
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 text-[11px] text-muted">
                  <Flame
                    size={11}
                    className={entry.streakCount > 0 ? "text-accent" : "text-muted"}
                  />
                  <span>
                    {entry.streakCount}
                    {t.progStreakUnit}
                  </span>
                </div>

                <div className="text-right font-bold tracking-wider text-accent">
                  {entry.xp.toLocaleString()}
                </div>
              </div>
            );
          })}

          {leaderboard.top50.length === 0 && (
            <div className="p-8 text-center font-mono text-xs text-muted">
              {period === "all_time" ? t.noPlayers : t.noPeriodPlayers}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
