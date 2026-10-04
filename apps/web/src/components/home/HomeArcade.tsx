"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Flame, Target, Zap } from "lucide-react";
import { useHome } from "@/components/home/useHome";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { fillTemplate } from "@/lib/i18n/merge";
import type { HomeModel } from "@/components/home/types";
import type { AppCopy } from "@/lib/copy";
import { HomeSkeleton } from "@/components/ui/Skeleton";
import { RestrictionModal } from "@/components/ui/RestrictionModal";

function duration(mins: number, t: AppCopy) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return fillTemplate(t.homeDurationMin, { m });
  return m
    ? fillTemplate(t.homeDurationHoursMin, { h, m })
    : fillTemplate(t.homeDurationHours, { h });
}

export function HomeArcade() {
  const { model, ready } = useHome();
  if (!ready) return <HomeSkeleton />;
  return (
    <article className="home home-arcade">
      <Hud model={model} />
      <div className="hx-cab">
        <Cabinet model={model} />
        <Stats model={model} />
        {!model.isPro && <CoinDoor model={model} />}
      </div>
      <Marquee model={model} />
    </article>
  );
}

function Hud({ model }: { model: HomeModel }) {
  const t = useAppCopy(model.language);
  return (
    <header className="hx-hud">
      <span className="hx-hud-score">
        <i>{t.homeHudXp}</i>
        <b>{model.xp.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false })}</b>
      </span>
      <span className="hx-hud-title">
        <span className="hx-hud-title-top">{t.homeBrand}</span>
      </span>
      <span className="hx-hud-hi">
        <i>{t.homeHudLast}</i>
        <b>{model.lastPercent != null ? `${model.lastPercent}%` : "000"}</b>
      </span>
    </header>
  );
}


function Cabinet({ model }: { model: HomeModel }) {
  const [restrictionType, setRestrictionType] = useState<"questions" | "duels" | "mistakes" | null>(null);
  const t = useAppCopy(model.language);
  const limit = t.homeDailyLimit;
  const timedSub = fillTemplate(t.homeSubTimed, { n: model.mockCount });
  // Quick 10 / Exam / Mistakes all launch into the selected subject, so name it.
  const inSubject = (sub: string) => `${model.subjectName} · ${sub}`;

  const modes = [
    {
      href: model.quickHref,
      label: t.homeQuick10,
      sub:
        !model.isPro && model.freeQuestionsLeft <= 0
          ? limit
          : inSubject(t.homeSub10NoTimer),
      on: true,
      onClick: (e: React.MouseEvent) => {
        if (!model.isPro && model.freeQuestionsLeft <= 0) {
          e.preventDefault();
          setRestrictionType("questions");
        }
      },
    },
    {
      href: model.examHref,
      label: t.homeExam,
      sub:
        !model.isPro && model.freeQuestionsLeft <= 0 ? limit : inSubject(timedSub),
      on: false,
      onClick: (e: React.MouseEvent) => {
        if (!model.isPro && model.freeQuestionsLeft <= 0) {
          e.preventDefault();
          setRestrictionType("questions");
        }
      },
    },
    {
      href: "/app/duel",
      label: t.homeDuel,
      sub: !model.isPro && model.freeQuestionsLeft <= 0 ? limit : t.homeSubDuelFriends,
      on: false,
      onClick: (e: React.MouseEvent) => {
        if (!model.isPro && model.freeQuestionsLeft <= 0) {
          e.preventDefault();
          setRestrictionType("questions");
        }
      },
    },
    {
      href: "/app/mistakes",
      label: t.homeMistakeBank,
      sub: inSubject(t.homeSubRetryWeak),
      on: false,
    },
    { href: "/app/leaderboard", label: t.homeLeaderboard, sub: t.homeSubRankings, on: false },
    {
      href: "/app/totals",
      label: t.marksTitle,
      sub: t.marksMockOnly,
      on: false,
    },
    {
      href: model.lastReviewHref ?? model.historyHref,
      label: t.homeReview,
      sub:
        model.lastPercent != null
          ? fillTemplate(t.homeSubLastScore, { n: model.lastPercent })
          : t.homeSubNoSitting,
      on: false,
    },
    {
      href: "/app/notes",
      label: t.homeNotes,
      sub: t.homeSubNotes,
      on: false,
    },
  ];

  return (
    <div className="hx-crt">
      <RestrictionModal
        open={restrictionType !== null}
        onClose={() => setRestrictionType(null)}
        type={restrictionType ?? "questions"}
      />
      <p className="hx-crt-kicker">
        <span>▚ {t.homeSelectMode}</span>
        <span className="hx-crt-credit">
          {model.isPro
            ? t.homeCreditPro
            : fillTemplate(t.homeCreditFree, { left: Math.max(0, model.freeQuestionsLeft) })}
        </span>
      </p>
      <h1>
        {t.homeReady}<span className="hx-blink">_</span>
      </h1>
      <nav className="hx-cart" aria-label={t.homeModesAria}>
        {modes.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            onClick={m.onClick}
            className={m.on ? "is-on" : undefined}
          >
            <b>
              <span className="hx-cart-cursor" aria-hidden>
                {m.on ? "▶" : " "}
              </span>
              {m.label}
            </b>
            <small>{m.sub}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Stats({ model }: { model: HomeModel }) {
  const t = useAppCopy(model.language);
  return (
    <section className="hx-stats" aria-label={t.homeStatsAria}>
      <div className="hx-stats-head">
        <span className="kicker">▚ {t.homeStatsKicker}</span>
        <span className="hx-stats-badge">
          <Flame size={12} className={model.streak > 0 ? "text-accent" : "text-muted"} />
          <span>{fillTemplate(t.homeStatsStreakBadge, { n: model.streak })}</span>
        </span>
      </div>

      <div className="hx-stats-grid">
        <div className="hx-stat-card">
          <div className="hx-stat-label">
            <span>{t.homeStatsStreak}</span>
            <Flame size={13} className={model.streak > 0 ? "text-accent" : "text-muted"} />
          </div>
          <div className="hx-stat-num">
            <b>{model.streak}</b>
            <small>{t.homeStatsDays}</small>
          </div>
          <div className="hx-streak-track" title={fillTemplate(t.homeStreakTooltip, { n: model.streak })}>
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className={`hx-streak-segment ${
                  i < Math.min(7, model.streak || (model.todayDone > 0 ? 1 : 0)) ? "is-lit" : ""
                }`}
              />
            ))}
          </div>
        </div>

        <div className="hx-stat-card">
          <div className="hx-stat-label">
            <span>{t.homeStatsGoal}</span>
            <Target
              size={13}
              className={model.todayDone >= model.dailyGoal ? "text-accent" : "text-muted"}
            />
          </div>
          <div className="hx-stat-num">
            <b>{model.todayDone}</b>
            <small>{fillTemplate(t.homeGoalUnit, { n: model.dailyGoal })}</small>
          </div>
          <div className="hx-goal-track">
            <span
              className="hx-goal-bar"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((model.todayDone / Math.max(1, model.dailyGoal)) * 100),
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="hx-stat-card">
          <div className="hx-stat-label">
            <span>{t.homeStatsScore}</span>
            <Zap size={13} className="text-accent" />
          </div>
          <div className="hx-stat-num">
            <b>{model.xp.toLocaleString()}</b>
            <small>{t.homeHudXp}</small>
          </div>
          <div
            className="hx-goal-track"
            title={fillTemplate(t.homeGoalTrack, {
              current: model.xp % 100,
              next: Math.floor(model.xp / 100) * 100 + 100,
            })}
          >
            <span
              className="hx-goal-bar"
              style={{ width: `${model.xp % 100}%` }}
            />
          </div>
        </div>
      </div>

      {model.sittings.length > 0 && (
        <div className="hx-stats-recap">
          <span className="hx-recap-label">{t.homeStatsRecent}</span>
          <div className="hx-recap-chips">
            {model.sittings.map((s, i) => (
              <Link key={i} href={s.reviewHref} className="hx-recap-chip">
                <b>{s.percent}%</b>
                <span>{s.title}</span>
                <ArrowUpRight size={11} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CoinDoor({ model }: { model: HomeModel }) {
  const [showDetails, setShowDetails] = useState(false);
  const t = useAppCopy(model.language);

  const left = Math.max(0, model.freeQuestionsLeft);
  const max = model.freeQuestionsMax;
  const used = Math.min(max, max - left);
  const pct = max ? Math.round((used / max) * 100) : 0;
  const depleted = left <= 0;

  const summaryParts: string[] = [];
  for (const item of model.usageToday) {
    summaryParts.push(`${item.questions} ${item.label.toLowerCase()}`);
  }

  return (
    <div className={`hx-coin-door cab ${depleted ? "is-depleted" : ""}`}>
      <div className="hx-coin-door-head">
        <span className="kicker">▚ {t.homeCoinOp}</span>
        <span className={`hx-quota-badge ${depleted ? "is-empty" : ""}`}>
          {depleted ? t.homeQuotaEmpty : fillTemplate(t.homeQuotaLeft, { left, max })}
        </span>
      </div>

      <div className="hx-quota-track" aria-hidden>
        <span className="hx-quota-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="hx-coin-door-compact">
        <p className="hx-quota-copy">
          {depleted
            ? t.homeUpgradeHint
            : fillTemplate(t.homeQuotaUsed, { used, max })}
        </p>
        <div className="hx-coin-door-actions">
          <button
            type="button"
            className={`hx-quota-details-btn ${showDetails ? "is-open" : ""}`}
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
          >
            {t.homeQuotaDetails}
            <ChevronDown size={12} />
          </button>
          <Link href={model.proHref} className="hx-coin-btn-compact">
            {t.homeQuotaGoPro} <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {showDetails && (
        <div className="hx-quota-details">
          {model.usageToday.length === 0 ? (
            <p className="hx-quota-detail-empty">{t.homeQuotaNoActivity}</p>
          ) : (
            <ul className="hx-quota-detail-list">
              {model.usageToday.map((item, i) => (
                <li key={`${item.label}-${i}`}>
                  <span>{item.label}</span>
                  <b>{fillTemplate(t.homeQuotaUnit, { n: item.questions })}</b>
                </li>
              ))}
            </ul>
          )}
          {summaryParts.length > 0 && (
            <p className="hx-quota-detail-summary">
              {fillTemplate(t.homeQuotaUsedSummary, { summary: summaryParts.join(" · ") })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Marquee({ model }: { model: HomeModel }) {
  const t = useAppCopy(model.language);
  const proBit = model.isPro ? t.homeMarqueePro : t.homeMarqueeCoin;
  const text = `${proBit} ${model.trackName.toUpperCase()} ★ ${fillTemplate(t.homeMarqueeQuestions, { n: model.mockCount })} ★ ${fillTemplate(t.homeMarqueeRun, { duration: duration(model.mockMinutes, t).toUpperCase() })} ★ ${fillTemplate(t.homeMarqueeStreak, { n: model.streak })} ★ ${fillTemplate(t.homeMarqueeLuck, { name: model.name.toUpperCase() })} ★\u00a0`;
  return (
    <div className="hx-marquee" aria-hidden>
      <span className="hx-marquee-strip">{text}</span>
      <span className="hx-marquee-strip" aria-hidden>
        {text}
      </span>
    </div>
  );
}
