"use client";

import { Pipette } from "lucide-react";
import { Field } from "@/components/ui/controls";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import {
  ACCENTS,
  THEMES,
  ThemeName,
  accentHex,
  canonicalTheme,
  isNamedAccent,
} from "@/lib/theme";

export function AppearancePicker({
  theme,
  accent,
  onTheme,
  onAccent,
  themeLabel,
  accentLabel,
}: {
  theme: string;
  accent: string;
  onTheme: (value: ThemeName) => void;
  onAccent: (value: string) => void;
  themeLabel: string;
  accentLabel: string;
}) {
  const selected = canonicalTheme(theme);
  const hex = accentHex(accent);
  const customOn = !isNamedAccent(accent);
  const t = useAppCopy();
  const modeLabels: Record<"dark" | "light", string> = {
    dark: t.shellModeDark,
    light: t.shellModeLight,
  };
  const themeText: Record<ThemeName, { label: string; hint: string }> = {
    obsidian: { label: t.shellThemeObsidian, hint: t.shellThemeObsidianHint },
    midnight: { label: t.shellThemeMidnight, hint: t.shellThemeMidnightHint },
    crt: { label: t.shellThemeCrt, hint: t.shellThemeCrtHint },
    paper: { label: t.shellThemePaper, hint: t.shellThemePaperHint },
    snow: { label: t.shellThemeSnow, hint: t.shellThemeSnowHint },
    sand: { label: t.shellThemeSand, hint: t.shellThemeSandHint },
  };

  return (
    <div className="grid gap-5">
      <Field label={themeLabel}>
        <div className="grid gap-4">
          {(["dark", "light"] as const).map((mode) => (
            <div key={mode}>
              <p className="look-mode">{modeLabels[mode]}</p>
              <div className="look-themes">
                {THEMES.filter((item) => item.mode === mode).map((item) => {
                  const on = selected === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onTheme(item.id)}
                      className={`look-theme ${on ? "is-on" : ""}`}
                      style={{
                        background: item.preview.bg,
                        color: item.preview.ink,
                      }}
                    >
                      <span className="look-theme-chips" aria-hidden>
                        <span style={{ background: item.preview.bg }} />
                        <span style={{ background: item.preview.surface }} />
                        <span style={{ background: item.preview.ink }} />
                      </span>
                      <b>{themeText[item.id].label}</b>
                      <small>{themeText[item.id].hint}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Field>
      <Field label={accentLabel}>
        <div className="look-accents">
          {ACCENTS.map((item) => {
            const on = accent === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={on}
                onClick={() => onAccent(item.id)}
                className={`look-swatch ${on ? "is-on" : ""}`}
                style={{ background: item.hex }}
              />
            );
          })}
          <label
            className={`look-swatch look-swatch-custom ${customOn ? "is-on" : ""}`}
            style={customOn ? { background: hex } : undefined}
          >
            <input
              type="color"
              value={hex}
              aria-label={t.shellCustomAccent}
              onChange={(event) => {
                const next = event.target.value.toLowerCase();
                const named = ACCENTS.find((item) => item.hex === next);
                onAccent(named ? named.id : next);
              }}
            />
            <Pipette size={14} />
          </label>
        </div>
      </Field>
    </div>
  );
}
