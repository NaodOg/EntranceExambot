import type { Lang } from "@/lib/copy";

export type I18nNamespace = "app" | "bot";

export type TranslationOverride = {
  namespace: I18nNamespace;
  key: string;
  textEn: string;
  textAm: string;
};

export type OverrideMap = Map<string, TranslationOverride>;

export function overridesToMap(rows: TranslationOverride[]): OverrideMap {
  const map = new Map<string, TranslationOverride>();
  for (const row of rows) {
    map.set(`${row.namespace}:${row.key}`, row);
  }
  return map;
}

function applyValue(base: unknown, textEn: string, textAm: string, lang: Lang): unknown {
  if (Array.isArray(base)) {
    try {
      return JSON.parse(lang === "en" ? textEn : textAm) as unknown;
    } catch {
      return lang === "en" ? textEn : textAm;
    }
  }
  return lang === "en" ? textEn : textAm;
}

export function mergeLocale(
  baseEn: Record<string, unknown>,
  baseAm: Record<string, unknown>,
  namespace: I18nNamespace,
  overrides: OverrideMap,
  lang: Lang,
): Record<string, unknown> {
  const base = lang === "am" ? baseAm : baseEn;
  const out = { ...base };
  for (const key of Object.keys(baseEn)) {
    const row = overrides.get(`${namespace}:${key}`);
    if (!row) continue;
    out[key] = applyValue(baseEn[key], row.textEn, row.textAm, lang);
  }
  return out;
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}
