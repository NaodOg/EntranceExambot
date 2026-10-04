"use client";

import { useMutation, useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { ThemeName, applyAppearance, canonicalAccent, canonicalTheme } from "@/lib/theme";
import { AppearancePicker } from "@/components/ui/AppearancePicker";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Languages,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { getSubjectIcon, getTrackIcon } from "@/lib/trackIcon";

export function Onboarding({
  telegramId,
  profile,
}: {
  telegramId: string;
  profile: {
    language: "am" | "en";
    trackSlug?: string;
    subjectSlugs?: string[];
    theme: string;
    accent: string;
  };
}) {
  const tracks = useQuery(api.exams.listPublishedTracks);
  const save = useMutation(api.users.updatePreferences);

  const LAST_STEP = 3;
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<"am" | "en">(profile.language || "en");
  const [trackSlug, setTrackSlug] = useState<string>(profile.trackSlug ?? "");
  // Restore prior picks so reopening onboarding does not silently clear them.
  const [subjectSlugs, setSubjectSlugs] = useState<string[]>(
    profile.subjectSlugs ?? [],
  );

  // Subjects for the chosen track, driving the next step.
  const subjects = useQuery(
    api.exams.listPublishedSubjects,
    trackSlug ? { trackSlug } : "skip",
  );

  // Pre-select Obsidian theme and Azure (light blue) accent by default
  const [theme, setTheme] = useState<ThemeName>(
    profile.theme && profile.theme !== "midnight"
      ? canonicalTheme(profile.theme)
      : "obsidian",
  );
  const [accent, setAccent] = useState(
    profile.accent && profile.accent !== "gold"
      ? canonicalAccent(profile.accent)
      : "azure",
  );

  const [saving, setSaving] = useState(false);
  const t = useAppCopy(language);

  // Fall back to the first published track once the list loads.
  useEffect(() => {
    if (tracks && tracks.length > 0 && !tracks.some((tr) => tr.slug === trackSlug)) {
      setTrackSlug(tracks[0]?.slug ?? "");
      setSubjectSlugs([]);
    }
  }, [tracks, trackSlug]);

  // Drop subject picks that are not in the current track.
  useEffect(() => {
    if (!subjects) return;
    setSubjectSlugs((prev) =>
      prev.filter((slug) => subjects.some((subject) => subject.slug === slug)),
    );
  }, [subjects]);

  useEffect(() => {
    applyAppearance({ theme, accent });
  }, [theme, accent]);

  function toggleSubject(slug: string) {
    setSubjectSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function complete() {
    if (saving) return;
    setSaving(true);
    try {
      await save({
        telegramId,
        language,
        trackSlug,
        subjectSlugs,
        theme,
        accent,
        onboardingComplete: true,
      });
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      setSaving(false);
    }
  }

  const stepLabels = [
    { num: "01", name: t.onbStepLocale },
    { num: "02", name: t.onbStepTrack },
    { num: "03", name: t.onbStepSubject },
    { num: "04", name: t.onbStepTerminal },
  ];

  // A step is only skippable once it has an answer.
  const canAdvance =
    step === 0
      ? true
      : step === 1
        ? Boolean(trackSlug)
        : step === 2
          ? subjectSlugs.length > 0
          : true;

  const nextLabel =
    step === 1
      ? t.onbChooseSubjects
      : step === 2
        ? t.onbDone
        : step === LAST_STEP
          ? t.onbEnter
          : t.next;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-between p-5 pb-8">
      {/* Header & Step progress indicator */}
      <div>
        <div className="flex items-center justify-between">
          <p className="kicker">▚ {t.brand.toUpperCase()}</p>
          <span className="font-mono text-xs font-bold text-accent tracking-widest uppercase">
            {t.onbStepProgress.replace("{n}", String(step + 1))}
          </span>
        </div>

        <h1 className="font-mono mt-2 text-2xl sm:text-3xl font-bold tracking-wide">
          {step === 0 && t.onbHeadingLocale}
          {step === 1 && t.onbHeadingTrack}
          {step === 2 && t.onbHeadingSubject}
          {step === LAST_STEP && t.onbHeadingTerminal}
        </h1>

        <div className="mt-4 flex gap-2">
          {stepLabels.map((item, idx) => (
            <div key={item.num} className="flex-1">
              <div
                className={`h-1 w-full transition-colors duration-300 ${
                  idx <= step ? "bg-accent" : "bg-surface-2"
                }`}
              />
              <span className="font-mono mt-1 block text-[10px] text-muted tracking-wider uppercase">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="my-6 flex-1">
        <AnimatePresence mode="wait">
          {/* STEP 0: LANGUAGE SELECTION */}
          {step === 0 && (
            <motion.div
              key="step-language"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <div>
                <p className="text-sm text-muted">{t.onbLocaleHelper}</p>
              </div>

              {/* Compact, elegant dual-card selector */}
              <div className="grid grid-cols-2 gap-3 mt-1">
                {/* English Option */}
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`cab relative flex flex-col justify-between p-4 text-left transition-all ${
                    language === "en"
                      ? "border-accent bg-accent/10 shadow-[0_0_16px_rgba(var(--accent-rgb),0.12)] ring-1 ring-accent"
                      : "border-line hover:border-line-strong hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold tracking-widest text-accent">
                      {t.onbLangEnBadge}
                    </span>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                        language === "en"
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-line bg-transparent"
                      }`}
                    >
                      {language === "en" && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>

                  <div className="mt-4">
                    <b className="font-mono text-base font-bold text-ink block">
                      {t.onbLangEnTitle}
                    </b>
                    <span className="text-xs text-muted block mt-0.5">
                      {t.onbLangEnSub}
                    </span>
                  </div>
                </button>

                {/* Amharic Option */}
                <button
                  type="button"
                  onClick={() => setLanguage("am")}
                  className={`cab relative flex flex-col justify-between p-4 text-left transition-all ${
                    language === "am"
                      ? "border-accent bg-accent/10 shadow-[0_0_16px_rgba(var(--accent-rgb),0.12)] ring-1 ring-accent"
                      : "border-line hover:border-line-strong hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold tracking-widest text-accent">
                      {t.onbLangAmBadge}
                    </span>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                        language === "am"
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-line bg-transparent"
                      }`}
                    >
                      {language === "am" && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>

                  <div className="mt-4">
                    <b className="text-base font-bold text-ink block">
                      {t.onbLangAmTitle}
                    </b>
                    <span className="text-xs text-muted block mt-0.5">
                      {t.onbLangAmSub}
                    </span>
                  </div>
                </button>
              </div>

              {/* Informational note banner */}
              <div className="cab p-3.5 border border-dashed border-line flex items-start gap-2.5 text-xs text-muted">
                <Languages size={16} className="text-accent shrink-0 mt-0.5" />
                <p className="leading-relaxed">{t.onbLangTip}</p>
              </div>
            </motion.div>
          )}

          {/* STEP 1: TRACK SELECTION */}
          {step === 1 && (
            <motion.div
              key="step-track"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <div>
                <p className="text-sm text-muted">{t.onbTrackHelper}</p>
                <div className="cab mt-3 flex items-start gap-2.5 border border-dashed border-accent/40 bg-accent/5 p-3 text-xs leading-relaxed text-ink">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0 text-accent" />
                  <p>{t.trackChooseCareful}</p>
                </div>
              </div>

              <div className="grid gap-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
                {tracks === undefined ? (
                  // Skeleton loading cards
                  [1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="cab p-4 flex items-center justify-between animate-pulse"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-surface-2 rounded" />
                        <div className="space-y-1.5">
                          <div className="h-4 w-32 bg-surface-2 rounded" />
                          <div className="h-3 w-48 bg-surface-2 rounded" />
                        </div>
                      </div>
                      <div className="h-5 w-5 rounded-full bg-surface-2" />
                    </div>
                  ))
                ) : tracks.length === 0 ? (
                  <div className="cab p-6 text-center font-mono text-xs text-muted">
                    {t.onbNoTracks}
                  </div>
                ) : (
                  tracks.map((track) => {
                    const isSelected = trackSlug === track.slug;
                    const Icon = getTrackIcon(track.slug);

                    return (
                      <button
                        key={track.slug}
                        type="button"
                        onClick={() => setTrackSlug(track.slug)}
                        className={`cab flex items-center justify-between gap-3 p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-accent bg-accent/10 shadow-[0_0_16px_rgba(var(--accent-rgb),0.12)] ring-1 ring-accent"
                            : "border-line hover:border-line-strong hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border transition-colors ${
                              isSelected
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-line bg-surface-2 text-muted"
                            }`}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold tracking-wide text-ink truncate">
                                {track.nameEn}
                              </span>
                              {track.nameAm && (
                                <span className="text-xs text-muted truncate">
                                  ({track.nameAm})
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted truncate mt-0.5">
                              {language === "am" && track.descriptionAm
                                ? track.descriptionAm
                                : track.descriptionEn || t.onbTrackFallback}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {track.subjectCount != null && track.subjectCount > 0 && (
                            <span className="hidden sm:inline-block font-mono text-[10px] text-muted tracking-wider uppercase border border-line px-1.5 py-0.5">
                              {t.onbSubjectCountSuffix.replace(
                                "{n}",
                                String(track.subjectCount),
                              )}
                            </span>
                          )}
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                              isSelected
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-line bg-transparent"
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: SUBJECT SELECTION */}
          {step === 2 && (
            <motion.div
              key="step-subject"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <div>
                <p className="text-sm text-muted">{t.onbSubjectHelper}</p>
                <div className="cab mt-3 flex items-start gap-2.5 border border-dashed border-accent/40 bg-accent/5 p-3 text-xs leading-relaxed text-ink">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0 text-accent" />
                  <p>{t.subjectChooseNote}</p>
                </div>
              </div>

              <div className="grid gap-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
                {subjects === undefined ? (
                  [1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="cab p-4 flex items-center justify-between animate-pulse"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-surface-2 rounded" />
                        <div className="space-y-1.5">
                          <div className="h-4 w-32 bg-surface-2 rounded" />
                          <div className="h-3 w-48 bg-surface-2 rounded" />
                        </div>
                      </div>
                      <div className="h-5 w-5 rounded-full bg-surface-2" />
                    </div>
                  ))
                ) : subjects.length === 0 ? (
                  <div className="cab p-6 text-center font-mono text-xs text-muted">
                    {t.onbNoSubjects}
                  </div>
                ) : (
                  subjects.map((subject) => {
                    const isSelected = subjectSlugs.includes(subject.slug);
                    const Icon = getSubjectIcon(subject.slug);

                    return (
                      <button
                        key={subject.slug}
                        type="button"
                        onClick={() => toggleSubject(subject.slug)}
                        className={`cab flex items-center justify-between gap-3 p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-accent bg-accent/10 shadow-[0_0_16px_rgba(var(--accent-rgb),0.12)] ring-1 ring-accent"
                            : "border-line hover:border-line-strong hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border transition-colors ${
                              isSelected
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-line bg-surface-2 text-muted"
                            }`}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold tracking-wide text-ink truncate">
                                {subject.nameEn}
                              </span>
                              {subject.nameAm && (
                                <span className="text-xs text-muted truncate">
                                  ({subject.nameAm})
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted truncate mt-0.5">
                              {language === "am" && subject.descriptionAm
                                ? subject.descriptionAm
                                : subject.descriptionEn || t.onbSubjectFallback}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {subject.maxMarks ? (
                            <span className="hidden sm:inline-block font-mono text-[10px] text-muted tracking-wider uppercase border border-line px-1.5 py-0.5">
                              {t.onbMarksSuffix.replace(
                                "{n}",
                                String(subject.maxMarks),
                              )}
                            </span>
                          ) : null}
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                              isSelected
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-line bg-transparent"
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3: APPEARANCE & THEME SELECTION */}
          {step === LAST_STEP && (
            <motion.div
              key="step-appearance"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <div>
                <p className="text-sm text-muted">{t.onbAppearanceHelper}</p>
              </div>

              {/* Live Arcade HUD Preview */}
              <div className="cab p-3 flex items-center justify-between border-accent/40 bg-accent/5">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={16} className="text-accent shrink-0" />
                  <div>
                    <span className="kicker block text-[10px]">
                      {t.onbPreviewKicker}
                    </span>
                    <span className="font-mono text-xs font-bold text-ink uppercase">
                      {theme.toUpperCase()} · {accent.toUpperCase()}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 border border-accent text-accent uppercase tracking-wider">
                  {t.onbPreviewBadge}
                </span>
              </div>

              <AppearancePicker
                theme={theme}
                accent={accent}
                onTheme={setTheme}
                onAccent={setAccent}
                themeLabel={t.theme}
                accentLabel={t.accent}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Step Actions */}
      <div className="mt-4 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            className="btn btn-ghost px-4 py-3 font-mono text-xs uppercase flex items-center gap-1.5"
            onClick={() => setStep((val) => val - 1)}
          >
            <ArrowLeft size={14} />
            {t.onbBack}
          </button>
        )}

        <button
          type="button"
          disabled={saving || !canAdvance}
          className="btn btn-primary flex-1 py-3 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40"
          onClick={() => {
            if (step < LAST_STEP) {
              setStep((val) => val + 1);
            } else {
              void complete();
            }
          }}
        >
          {saving ? (
            t.onbSaving
          ) : step === LAST_STEP ? (
            <>{t.onbEnter}</>
          ) : (
            <>
              {nextLabel}
              <ChevronRight size={14} />
            </>
          )}
        </button>
      </div>
    </main>
  );
}