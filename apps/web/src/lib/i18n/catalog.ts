import { copy } from "@/lib/copy";
import { botCopy } from "@/lib/bot/copy";
import type { I18nNamespace } from "./merge";

export type CatalogRow = {
  namespace: I18nNamespace;
  key: string;
  textEn: string;
  textAm: string;
  kind: "string" | "json";
};

function localeToRows(
  namespace: I18nNamespace,
  en: Record<string, unknown>,
  am: Record<string, unknown>,
): CatalogRow[] {
  const keys = new Set([...Object.keys(en), ...Object.keys(am)]);
  const rows: CatalogRow[] = [];
  for (const key of [...keys].sort()) {
    const ev = en[key];
    const av = am[key];
    const kind = Array.isArray(ev) || Array.isArray(av) ? "json" : "string";
    rows.push({
      namespace,
      key,
      textEn: kind === "json" ? JSON.stringify(ev ?? null, null, 2) : String(ev ?? ""),
      textAm: kind === "json" ? JSON.stringify(av ?? null, null, 2) : String(av ?? ""),
      kind,
    });
  }
  return rows;
}

export const TRANSLATION_CATALOG: CatalogRow[] = [
  ...localeToRows("app", copy.en as Record<string, unknown>, copy.am as Record<string, unknown>),
  ...localeToRows("bot", botCopy.en as Record<string, unknown>, botCopy.am as Record<string, unknown>),
];
