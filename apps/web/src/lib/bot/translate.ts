import { botCopy, type BotCopy, type Lang } from "./copy";
import { getActiveMergedBot } from "./i18n-overrides";

export function t(lang: Lang): BotCopy {
  const merged = getActiveMergedBot();
  if (merged) {
    return merged[lang] ?? botCopy.en;
  }
  return botCopy[lang] ?? botCopy.en;
}
