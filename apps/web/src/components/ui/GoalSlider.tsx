"use client";

import { PointerEvent, useRef } from "react";
import { useAppCopy } from "@/lib/i18n/CopyProvider";

const RANKS = [
  { max: 15, key: "warmup" },
  { max: 30, key: "steady" },
  { max: 50, key: "grind" },
  { max: 80, key: "marathon" },
] as const;

type GoalRank = (typeof RANKS)[number]["key"];

function snap(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped / step) * step;
}

function scaleTicks(min: number, max: number): number[] {
  const raw = max <= 20 ? [min, 10, 15, max] : [min, 20, 40, 60, max];
  return [...new Set(raw.filter((tick) => tick >= min && tick <= max))].sort(
    (a, b) => a - b,
  );
}

function rankFor(value: number): GoalRank {
  return RANKS.find((rank) => value <= rank.max)?.key ?? "marathon";
}

export function GoalSlider({
  value,
  onChange,
  min = 5,
  max = 80,
  step = 1,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const t = useAppCopy();
  const rankLabels: Record<GoalRank, string> = {
    warmup: t.shellGoalRankWarmup,
    steady: t.shellGoalRankSteady,
    grind: t.shellGoalRankGrind,
    marathon: t.shellGoalRankMarathon,
  };
  const ticks = scaleTicks(min, max);
  const clamped = snap(value, min, max, step);
  const pct = ((clamped - min) / (max - min)) * 100;

  function valueFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return value;
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return snap(min + t * (max - min), min, max, step);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange(valueFromClientX(event.clientX));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onChange(valueFromClientX(event.clientX));
  }

  return (
    <div className="goal-meter">
      <div className="goal-meter-head">
        <div>
          <p className="goal-meter-kicker">{label}</p>
          <p className="goal-meter-rank">{rankLabels[rankFor(clamped)]}</p>
        </div>
        <p className="goal-meter-value">
          {String(clamped).padStart(2, "0")}
          <small>{t.shellGoalUnit}</small>
        </p>
      </div>
      <div
        ref={trackRef}
        className="goal-track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(snap(value - step, min, max, step));
          }
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(snap(value + step, min, max, step));
          }
        }}
      >
        <div className="goal-track-rail">
          <div className="goal-track-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="goal-ticks" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="goal-tick"
              style={{ left: `${((tick - min) / (max - min)) * 100}%` }}
            />
          ))}
        </div>
        <span className="goal-thumb" style={{ left: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          onChange={(event) => onChange(Number(event.target.value))}
          tabIndex={-1}
          aria-hidden
        />
      </div>
      <div className="goal-scale">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}
