import type { TranslationOverride } from "@/lib/i18n/merge";
import { mergedBotCopy } from "@/lib/i18n/botMerge";
import type { BotCopy, Lang } from "./copy";

let merged: Record<Lang, BotCopy> | null = null;

export function setRequestTranslationOverrides(overrides: TranslationOverride[]) {
  if (overrides.length === 0) {
    merged = null;
    return;
  }
  merged = {
    en: mergedBotCopy("en", overrides),
    am: mergedBotCopy("am", overrides),
  };
}

export function getActiveMergedBot(): Record<Lang, BotCopy> | null {
  return merged;
}
