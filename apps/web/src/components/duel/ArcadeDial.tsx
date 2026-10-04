"use client";

import { useEffect, useRef } from "react";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { fillTemplate } from "@/lib/i18n/merge";

export function ArcadeDial({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  presets,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  presets: number[];
  onChange: (next: number) => void;
}) {
  const holdRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  const t = useAppCopy();

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function clamp(next: number) {
    return Math.max(min, Math.min(max, next));
  }

  function startHold(delta: number) {
    const apply = (leap: number) => {
      const next = clamp(valueRef.current + leap);
      valueRef.current = next;
      onChange(next);
    };
    apply(delta > 0 ? step : -step);
    holdRef.current = window.setInterval(() => {
      apply(delta > 0 ? step : -step);
    }, 90);
  }

  function stopHold() {
    if (holdRef.current !== null) {
      window.clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }

  return (
    <div className="dx-dial">
      <p className="dx-dial-label">{label}</p>
      <div className="dx-dial-row">
        <button
          type="button"
          className="dx-step"
          disabled={value <= min}
          aria-label={fillTemplate(t.duelDecrease, { label })}
          onPointerDown={() => startHold(-step)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          −
        </button>
        <div className="dx-dial-value" aria-live="polite">
          {value}
          <span className="dx-dial-unit">{unit}</span>
        </div>
        <button
          type="button"
          className="dx-step"
          disabled={value >= max}
          aria-label={fillTemplate(t.duelIncrease, { label })}
          onPointerDown={() => startHold(step)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          +
        </button>
      </div>
      <div className="dx-chips">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`dx-chip ${value === preset ? "is-on" : ""}`}
            onClick={() => onChange(clamp(preset))}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
