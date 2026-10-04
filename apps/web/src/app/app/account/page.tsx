"use client";

import { useMutation, useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Lock, MessageCircle } from "lucide-react";
import { getTelegramWebApp } from "@/lib/telegram";
import { SUPPORT_TELEGRAM_URL } from "@/lib/copy";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { fillTemplate } from "@/lib/i18n/merge";
import { RestrictionModal } from "@/components/ui/RestrictionModal";
import {
  ACCENTS,
  THEMES,
  FontSizeName,
  ThemeName,
  applyAppearance,
  canonicalAccent,
  canonicalTheme,
} from "@/lib/theme";
import { Field, Segmented, Toggle } from "@/components/ui/controls";
import { AppearancePicker } from "@/components/ui/AppearancePicker";
import { Select } from "@/components/ui/Select";
import { GoalSlider } from "@/components/ui/GoalSlider";
import { AccountSkeleton } from "@/components/ui/Skeleton";
type Draft = {
  language: "am" | "en";
  trackSlug: string;
  theme: ThemeName;
  accent: string;
  fontSize: FontSizeName;
  dailyGoal: number;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  instantFeedback: boolean;
  reduceMotion: boolean;
};

const EMPTY: Draft = {
  language: "en",
  trackSlug: "",
  theme: "midnight",
  accent: "azure",
  fontSize: "md",
  dailyGoal: 20,
  hapticsEnabled: true,
  soundEnabled: false,
  instantFeedback: true,
  reduceMotion: false,
};

export default function AccountPage() {
  const { telegramId, colorScheme, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const tracks = useQuery(api.exams.listPublishedTracks);
  const save = useMutation(api.users.updatePreferences);
  const [lookOpen, setLookOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [trackProOpen, setTrackProOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [baseline, setBaseline] = useState<Draft>(EMPTY);

  useEffect(() => {
    if (!profile) return;
    const next: Draft = {
      language: profile.language,
      trackSlug: profile.trackSlug ?? "",
      theme: canonicalTheme(profile.theme, colorScheme),
      accent: canonicalAccent(profile.accent),
      fontSize: profile.fontSize,
      dailyGoal: profile.isProActive
        ? profile.dailyGoal
        : Math.min(20, profile.dailyGoal),
      hapticsEnabled: profile.hapticsEnabled,
      soundEnabled: profile.soundEnabled,
      instantFeedback: profile.instantFeedback,
      reduceMotion: profile.reduceMotion,
    };
    setDraft(next);
    setBaseline(next);
  }, [profile, colorScheme]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );
  const wasDirtyRef = useRef(false);

  // Live preview while editing only — saved look comes from AppShell / localStorage on load.
  useEffect(() => {
    if (profile === undefined) return;

    const look = dirty ? draft : baseline;
    const shouldApply = dirty || wasDirtyRef.current;
    wasDirtyRef.current = dirty;

    if (!shouldApply) return;

    applyAppearance({
      theme: look.theme,
      accent: look.accent,
      fontSize: look.fontSize,
      reduceMotion: look.reduceMotion,
      telegramScheme: colorScheme,
    });
  }, [profile, dirty, draft, baseline, colorScheme]);

  const t = useAppCopy(draft.language);

  async function onSave() {
    if (!dirty || saving || !profile) return;
    setSaving(true);
    setSaveError(false);
    try {
      await save({
        telegramId,
        language: draft.language,
        ...(profile.isProActive
          ? { trackSlug: draft.trackSlug || undefined }
          : {}),
        theme: draft.theme,
        accent: draft.accent,
        fontSize: draft.fontSize,
        dailyGoal: profile.isProActive ? draft.dailyGoal : Math.min(20, draft.dailyGoal),
        hapticsEnabled: draft.hapticsEnabled,
        soundEnabled: draft.soundEnabled,
        instantFeedback: draft.instantFeedback,
        reduceMotion: draft.reduceMotion,
      });
      setBaseline(draft);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const currentTheme = THEMES.find((item) => item.id === draft.theme);
  const currentAccent = ACCENTS.find((item) => item.id === draft.accent);

  if (profile === undefined) return <AccountSkeleton />;

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <main className={`flex flex-col gap-5 p-4 pt-6 ${dirty ? "pb-28" : "pb-8"}`}>
      <header>
        <p className="kicker">{t.account}</p>
        <h1 className="font-mono mt-2 text-3xl font-bold tracking-wide">
          {(profile?.firstName ?? t.proAppPlayerFallback).toUpperCase()}
        </h1>
        <p className="font-mono mt-1 text-xs tracking-wider text-muted">
          @{profile?.username ?? t.student} · {profile?.isProActive ? t.proActive : t.free}
        </p>
      </header>

      <Field label={t.language}>
        <Segmented
          value={draft.language}
          onChange={(value) => patch("language", value)}
          options={[
            { id: "en", label: t.proAppLanguageEnglish },
            { id: "am", label: t.proAppLanguageAmharic },
          ]}
        />
      </Field>

      <Field label={t.pickTrack}>
        {profile?.isProActive ? (
          <Select
            label={t.pickTrack}
            value={draft.trackSlug}
            onChange={(value) => patch("trackSlug", value)}
            placeholder={t.proAppSelectPlaceholder}
            options={(tracks ?? []).map((track) => ({
              id: track.slug,
              label: track.nameEn,
              hint: track.examCount
                ? fillTemplate(t.proAppExamsCount, { n: track.examCount })
                : undefined,
            }))}
          />
        ) : (
          <div className="grid gap-2">
            <div className="cab flex items-center justify-between gap-3 p-3">
              <span className="font-mono text-sm font-bold tracking-wide truncate">
                {(tracks ?? []).find((row) => row.slug === draft.trackSlug)?.nameEn
                  ?? draft.trackSlug
                  ?? "—"}
              </span>
              <Lock size={14} className="shrink-0 text-muted" />
            </div>
            <p className="text-xs leading-relaxed text-muted">{t.trackLocked}</p>
            <button
              type="button"
              className="btn btn-ghost w-full py-2.5 font-mono text-xs uppercase tracking-wider"
              onClick={() => setTrackProOpen(true)}
            >
              {t.changeTrackPro}
            </button>
          </div>
        )}
      </Field>

      <section className="border border-line bg-surface">
        <button
          type="button"
          aria-expanded={lookOpen}
          onClick={() => setLookOpen((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-3 text-left"
        >
          <span>
            <span className="kicker block">{t.theme}</span>
            <span className="font-mono mt-1 block text-xs tracking-wider text-muted">
              {currentTheme?.label ?? draft.theme}
              {" · "}
              {currentAccent?.label ?? t.proAppCustomAccent}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`text-muted transition-transform duration-200 ${lookOpen ? "rotate-180" : ""}`}
          />
        </button>
        {lookOpen && (
          <div className="border-t border-line px-3 py-4">
            <AppearancePicker
              theme={draft.theme}
              accent={draft.accent}
              onTheme={(value) => patch("theme", value)}
              onAccent={(value) => patch("accent", value)}
              themeLabel={t.theme}
              accentLabel={t.accent}
            />
          </div>
        )}
      </section>

      <GoalSlider
        label={t.dailyGoal}
        value={draft.dailyGoal}
        max={profile?.isProActive ? 80 : 20}
        onChange={(value) => patch("dailyGoal", value)}
      />

      <div className="surface grid gap-4 p-4">
        <Row label={t.haptics}>
          <Toggle checked={draft.hapticsEnabled} onChange={(value) => patch("hapticsEnabled", value)} label={t.haptics} />
        </Row>
        <Row label={t.sound}>
          <Toggle checked={draft.soundEnabled} onChange={(value) => patch("soundEnabled", value)} label={t.sound} />
        </Row>
        <Row label={t.instant}>
          <Toggle checked={draft.instantFeedback} onChange={(value) => patch("instantFeedback", value)} label={t.instant} />
        </Row>
      </div>

      <CollapsibleSection
        title={t.howItWorksTitle}
        open={howOpen}
        onToggle={() => setHowOpen((open) => !open)}
      >
        <ol className="grid list-none gap-3 text-sm leading-relaxed text-muted">
          {t.howItWorksSteps.map((step) => (
            <li key={step} className="whitespace-pre-line">
              {step}
            </li>
          ))}
        </ol>
      </CollapsibleSection>

      <CollapsibleSection
        title={t.supportTitle}
        open={supportOpen}
        onToggle={() => setSupportOpen((open) => !open)}
      >
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
          {t.supportBody}
        </p>
        <button
          type="button"
          className="btn btn-ghost mt-4 flex w-full items-center justify-center gap-2 py-2.5 font-mono text-xs uppercase tracking-wider"
          onClick={() => {
            const webApp = getTelegramWebApp();
            if (webApp) webApp.openLink(SUPPORT_TELEGRAM_URL);
            else window.open(SUPPORT_TELEGRAM_URL, "_blank", "noopener,noreferrer");
          }}
        >
          <MessageCircle size={14} />
          {t.supportOpen}
        </button>
      </CollapsibleSection>

      {dirty && (
        <div className="save-hover">
          {saveError && (
            <p className="mb-2 text-center text-sm text-red-400">
              {t.proAppSaveError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="save-hover-hit"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      )}

      <RestrictionModal
        open={trackProOpen}
        onClose={() => setTrackProOpen(false)}
        type="general"
        customTitle={t.changeTrackPro}
        customMessage={t.trackLocked}
      />
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-xs font-semibold uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-3 text-left"
      >
        <span className="font-mono text-xs font-semibold uppercase tracking-wider">{title}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-line px-3 py-4">{children}</div>}
    </section>
  );
}
