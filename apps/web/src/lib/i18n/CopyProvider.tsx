"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";
import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { useTelegramId } from "@/hooks/useTelegramId";
import { copy, type AppCopy, type Lang } from "@/lib/copy";
import { mergeLocale, overridesToMap, type TranslationOverride } from "./merge";

const CopyContext = createContext<{
  lang: Lang;
  overrides: TranslationOverride[];
  mergedApp: { en: AppCopy; am: AppCopy };
} | null>(null);

export function CopyProvider({ children }: { children: ReactNode }) {
  const { userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const queryOverrides = useQuery(api.translations.getOverrides);
  const overrides = useMemo(() => queryOverrides ?? [], [queryOverrides]);
  const lang: Lang = profile?.language === "am" ? "am" : "en";

  const value = useMemo(() => {
    const map = overridesToMap(overrides);
    for (const key of [
      "howItWorksTitle",
      "howItWorksSteps",
      "supportTitle",
      "supportBody",
      "supportOpen",
    ]) {
      map.delete(`app:${key}`);
    }
    return {
      lang,
      overrides,
      mergedApp: {
        en: mergeLocale(
          copy.en as Record<string, unknown>,
          copy.am as Record<string, unknown>,
          "app",
          map,
          "en",
        ) as AppCopy,
        am: mergeLocale(
          copy.en as Record<string, unknown>,
          copy.am as unknown as Record<string, unknown>,
          "app",
          map,
          "am",
        ) as AppCopy,
      },
    };
  }, [overrides, lang]);

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}

/** The active language for the current user (defaults to English). */
export function useAppLang(): Lang {
  return useContext(CopyContext)?.lang ?? "en";
}

/**
 * Returns the translated copy. Pass a language explicitly, or omit it to use
 * the active user language. Safe to call outside the provider (falls back to
 * the base copy).
 */
export function useAppCopy(lang?: Lang): AppCopy {
  const ctx = useContext(CopyContext);
  const resolved = lang ?? ctx?.lang ?? "en";
  if (!ctx) return copy[resolved] ?? copy.en;
  return ctx.mergedApp[resolved] ?? ctx.mergedApp.en;
}

export function useTranslationOverrides(): TranslationOverride[] {
  return useContext(CopyContext)?.overrides ?? [];
}
