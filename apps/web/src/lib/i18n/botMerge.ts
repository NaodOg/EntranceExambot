import { botCopy, type BotCopy } from "@/lib/bot/copy";
import type { Lang } from "@/lib/copy";
import { mergeLocale, overridesToMap, type TranslationOverride } from "./merge";

export function mergedBotCopy(lang: Lang, overrides: TranslationOverride[]): BotCopy {
  const map = overridesToMap(overrides);
  for (const key of [
    "howItWorksTitle",
    "howItWorksBody",
    "supportTitle",
    "supportBody",
    "openSupport",
  ]) {
    map.delete(`bot:${key}`);
  }
  return mergeLocale(
    botCopy.en as Record<string, unknown>,
    botCopy.am as unknown as Record<string, unknown>,
    "bot",
    map,
    lang,
  ) as BotCopy;
}
