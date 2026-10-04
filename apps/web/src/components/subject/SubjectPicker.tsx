"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { SubjectIcon } from "@/lib/trackIcon";
import type { Subject } from "@/hooks/useSubjectSelection";

/**
 * Compact subject selector for the subject-scoped screens (practice, duel,
 * mistakes). Reads as a single chip until tapped, then opens the full list for
 * the current track.
 */
export function SubjectPicker({
  subjects,
  value,
  onChange,
  label,
  disabled,
  emptyLabel,
}: {
  subjects: Subject[] | undefined;
  value: string | undefined;
  onChange: (slug: string) => void;
  label: string;
  disabled?: boolean;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!subjects || subjects.length === 0) {
    return (
      <div className="cab px-3 py-2.5 text-xs text-muted">{emptyLabel}</div>
    );
  }

  const current = subjects.find((row) => row.slug === value) ?? subjects[0];

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="cab flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-surface-2 text-muted">
          <SubjectIcon slug={current.slug} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] tracking-wider uppercase text-muted">
            {label}
          </span>
          <span className="block truncate text-sm font-bold text-ink">
            {current.nameEn}
          </span>
        </span>
        {current.maxMarks ? (
          <span className="font-mono shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] tracking-wider text-muted uppercase">
            {current.maxMarks}
          </span>
        ) : null}
        <ChevronDown
          size={15}
          className={`shrink-0 text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="cab absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto p-1 shadow-lg"
        >
          {subjects.map((row) => {
            const on = row.slug === current.slug;
            return (
              <li key={row.slug}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(row.slug);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors ${
                    on ? "bg-accent/10 text-accent" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="shrink-0 text-muted">
                    <SubjectIcon slug={row.slug} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{row.nameEn}</span>
                  {row.nameAm && row.nameAm !== row.nameEn ? (
                    <span className="shrink-0 truncate text-[11px] text-muted">
                      {row.nameAm}
                    </span>
                  ) : null}
                  {on ? <Check size={14} strokeWidth={3} className="shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}