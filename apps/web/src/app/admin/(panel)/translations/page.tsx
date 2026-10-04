"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ADMIN_EMAIL, useAdminMutation } from "@/lib/admin-client";
import { Badge, PageHeader } from "@/components/admin/ui";
import { TRANSLATION_CATALOG, type CatalogRow } from "@/lib/i18n/catalog";
import {
  SECTION_META,
  SECTION_ORDER,
  groupForRow,
  groupOrder,
  sectionForRow,
  type TranslationSection,
} from "@/lib/i18n/sections";
import { ChevronRight, Search } from "lucide-react";

type DraftRow = CatalogRow & {
  section: TranslationSection;
  group: string;
  draftEn: string;
  draftAm: string;
  customized: boolean;
  dirty: boolean;
};

const idOf = (row: { namespace: string; key: string }) => `${row.namespace}:${row.key}`;

export default function AdminTranslationsPage() {
  const overrides = useQuery(api.translations.getOverrides);
  const setOverride = useAdminMutation(api.translations.setOverride);
  const [section, setSection] = useState<TranslationSection>("bot");
  const [search, setSearch] = useState("");
  const [customOnly, setCustomOnly] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { en: string; am: string }>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const rows = useMemo((): DraftRow[] => {
    const overrideMap = new Map((overrides ?? []).map((row) => [idOf(row), row]));
    return TRANSLATION_CATALOG.map((row) => {
      const id = idOf(row);
      const custom = overrideMap.get(id);
      const baseEn = custom?.textEn ?? row.textEn;
      const baseAm = custom?.textAm ?? row.textAm;
      const draft = drafts[id];
      const draftEn = draft?.en ?? baseEn;
      const draftAm = draft?.am ?? baseAm;
      return {
        ...row,
        section: sectionForRow(row),
        group: groupForRow(row),
        textEn: baseEn,
        textAm: baseAm,
        draftEn,
        draftAm,
        customized: Boolean(custom),
        dirty: draftEn !== baseEn || draftAm !== baseAm,
      };
    });
  }, [overrides, drafts]);

  const sectionCounts = useMemo(() => {
    const counts = Object.fromEntries(
      SECTION_ORDER.map((key) => [key, { total: 0, custom: 0 }]),
    ) as Record<TranslationSection, { total: number; custom: number }>;
    for (const row of rows) {
      counts[row.section].total += 1;
      if (row.customized) counts[row.section].custom += 1;
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.section !== section) return false;
      if (customOnly && !row.customized) return false;
      if (!q) return true;
      return (
        row.key.toLowerCase().includes(q) ||
        row.draftEn.toLowerCase().includes(q) ||
        row.draftAm.toLowerCase().includes(q)
      );
    });
  }, [rows, section, search, customOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, DraftRow[]>();
    for (const row of filtered) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return groupOrder(section)
      .map((label) => ({ label, rows: map.get(label) ?? [] }))
      .filter((entry) => entry.rows.length > 0);
  }, [filtered, section]);

  const dirtyRows = filtered.filter((row) => row.dirty);
  const autoExpand = search.trim().length > 0 || customOnly;

  function patch(id: string, field: "en" | "am", value: string) {
    setDrafts((prev) => {
      const row = rows.find((r) => idOf(r) === id);
      if (!row) return prev;
      const current = prev[id] ?? { en: row.textEn, am: row.textAm };
      return { ...prev, [id]: { ...current, [field]: value } };
    });
  }

  function discard(id: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveRow(row: DraftRow) {
    const id = idOf(row);
    setSavingKey(id);
    try {
      await setOverride({
        namespace: row.namespace,
        key: row.key,
        textEn: row.draftEn,
        textAm: row.draftAm,
        adminEmail: ADMIN_EMAIL,
      });
      discard(id);
    } finally {
      setSavingKey(null);
    }
  }

  async function saveAll() {
    const targets = dirtyRows;
    if (!targets.length) return;
    for (const row of targets) {
      const id = idOf(row);
      setSavingKey(id);
      try {
        await setOverride({
          namespace: row.namespace,
          key: row.key,
          textEn: row.draftEn,
          textAm: row.draftAm,
          adminEmail: ADMIN_EMAIL,
        });
        discard(id);
      } finally {
        setSavingKey(null);
      }
    }
  }

  function toggleGroup(label: string) {
    const id = `${section}:${label}`;
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllGroups(closed: boolean) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const { label } of grouped) {
        const id = `${section}:${label}`;
        if (closed) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const isOpen = (label: string) =>
    autoExpand || !collapsed.has(`${section}:${label}`);

  return (
    <div className="grid min-w-0 gap-4">
      <PageHeader
        kicker="Localization"
        title="Translations"
        description="Edit English and Amharic copy, grouped by surface. Custom versions stay put — saving never wipes them."
      />

      <div className="flex min-w-0 flex-wrap gap-1.5 rounded-xl border border-line-strong bg-surface/60 p-1">
        {SECTION_ORDER.map((key) => {
          const meta = SECTION_META[key];
          const counts = sectionCounts[key];
          const active = section === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <span className="truncate">{meta.label}</span>
              <span className={`font-mono text-[10px] ${active ? "opacity-70" : "text-faint"}`}>
                {counts.total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            className="field min-h-10! w-full pl-9 text-sm!"
            placeholder="Search key, English or Amharic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <ToolButton active={customOnly} onClick={() => setCustomOnly((v) => !v)}>
          Custom
        </ToolButton>
        <ToolButton onClick={() => setAllGroups(false)}>Expand</ToolButton>
        <ToolButton onClick={() => setAllGroups(true)}>Collapse</ToolButton>
        {dirtyRows.length > 0 ? (
          <ToolButton primary disabled={savingKey !== null} onClick={() => void saveAll()}>
            Save {dirtyRows.length}
          </ToolButton>
        ) : null}
      </div>

      <p className="font-mono text-[11px] text-muted">
        {SECTION_META[section].description} · Showing {filtered.length} of{" "}
        {sectionCounts[section].total}
        {dirtyRows.length > 0 ? ` · ${dirtyRows.length} unsaved` : ""}
      </p>

      {overrides === undefined ? (
        <p className="py-5 text-center text-sm text-muted">Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="py-5 text-center text-sm text-muted">No keys match your filters.</p>
      ) : (
        <div className="grid min-w-0 gap-2">
          {grouped.map(({ label, rows: groupRows }) => {
            const open = isOpen(label);
            const customCount = groupRows.filter((r) => r.customized).length;
            const dirtyCount = groupRows.filter((r) => r.dirty).length;
            return (
              <div
                key={label}
                className="min-w-0 overflow-hidden rounded-xl border border-line-strong bg-surface/70"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(label)}
                  className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left active:bg-surface-2"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ChevronRight
                      size={15}
                      className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
                    />
                    <span className="truncate text-sm font-semibold">{label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {dirtyCount > 0 ? <Badge tone="accent">{dirtyCount}</Badge> : null}
                    {customCount > 0 ? <Badge tone="sage">{customCount}</Badge> : null}
                    <span className="font-mono text-[10px] text-faint">{groupRows.length}</span>
                  </span>
                </button>

                {open ? (
                  <div className="grid min-w-0 gap-2 border-t border-line p-2.5">
                    {groupRows.map((row) => {
                      const id = idOf(row);
                      const busy = savingKey === id;
                      return (
                        <div
                          key={id}
                          className="grid min-w-0 gap-2 rounded-lg border border-line bg-bg/30 p-2.5"
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <code className="min-w-0 truncate font-mono text-[11px] font-semibold text-ink">
                              {row.key}
                            </code>
                            {row.kind === "json" ? <Badge tone="accent">json</Badge> : null}
                            {row.customized ? <Badge tone="sage">custom</Badge> : null}
                            {row.dirty ? <Badge tone="accent">unsaved</Badge> : null}
                          </div>
                          <label className="grid min-w-0 gap-1 text-[11px] text-muted">
                            English
                            <textarea
                              className="field min-h-14! min-w-0 font-mono text-xs!"
                              value={row.draftEn}
                              onChange={(e) => patch(id, "en", e.target.value)}
                            />
                          </label>
                          <label className="grid min-w-0 gap-1 text-[11px] text-muted">
                            Amharic
                            <textarea
                              className="field min-h-14! min-w-0 font-mono text-xs!"
                              value={row.draftAm}
                              onChange={(e) => patch(id, "am", e.target.value)}
                            />
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!row.dirty || busy}
                              onClick={() => void saveRow(row)}
                              className="inline-flex min-h-8 items-center rounded-lg bg-accent px-3 text-[11px] font-semibold uppercase tracking-wide text-accent-ink disabled:opacity-40"
                            >
                              {busy ? "Saving…" : "Save"}
                            </button>
                            {row.dirty && !busy ? (
                              <button
                                type="button"
                                onClick={() => discard(id)}
                                className="inline-flex min-h-8 items-center rounded-lg border border-line-strong px-3 text-[11px] font-semibold uppercase tracking-wide text-muted"
                              >
                                Discard
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active = false,
  primary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  const style = primary
    ? "bg-accent text-accent-ink"
    : active
      ? "bg-accent/15 text-accent"
      : "border border-line-strong bg-surface text-ink active:bg-surface-2";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center rounded-lg px-3 text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-40 ${style}`}
    >
      {children}
    </button>
  );
}
