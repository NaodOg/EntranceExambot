"use client";

import { useMutation, useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import Link from "next/link";
import { useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { PageHeaderSkeleton, StageListSkeleton } from "@/components/ui/Skeleton";

export default function TotalsPage() {
  const { telegramId, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const totals = useQuery(
    api.marks.getTrackTotals,
    userArg === "skip" ? "skip" : userArg,
  );
  const t = useAppCopy(profile?.language ?? "en");
  const upsertManualMark = useMutation(api.marks.upsertManualMark);
  const deleteMarkEntry = useMutation(api.marks.deleteMarkEntry);
  const [editing, setEditing] = useState<string | null>(null);

  const auth = telegramId ? { telegramId } : {};

  if (totals === undefined) {
    return (
      <main className="flex flex-col gap-4 p-4 pt-6 is-skeleton">
        <PageHeaderSkeleton titleWidth="w-56" />
        <StageListSkeleton rows={6} />
      </main>
    );
  }

  if (!totals) {
    return (
      <main className="flex flex-col gap-4 p-4 pt-6">
        <Link
          href="/app"
          className="font-mono text-xs uppercase tracking-wider text-muted"
        >
          ← {t.backHome}
        </Link>
        <p className="cab p-5 font-mono text-sm text-muted">{t.marksEmpty}</p>
      </main>
    );
  }

  const trackName =
    totals.language === "am" ? totals.track.nameAm : totals.track.nameEn;

  return (
    <main className="flex flex-col gap-4 p-4 pt-6 pb-8">
      <Link
        href="/app"
        className="font-mono text-xs uppercase tracking-wider text-muted"
      >
        ← {t.backHome}
      </Link>

      <header>
        <p className="kicker">{trackName}</p>
        <h1 className="font-mono mt-2 text-3xl font-bold tracking-wide">
          {t.marksTitle}
        </h1>
      </header>

      <section className="cab p-5">
        <div className="font-mono flex items-baseline justify-between">
          <span className="text-4xl font-bold tracking-tight">
            {totals.earned}
          </span>
          <span className="text-sm text-muted">
            / {totals.trackMax} · {totals.percent}%
          </span>
        </div>
        <div
          className="bg-line mt-3 h-2 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={totals.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-accent h-full"
            style={{ width: `${Math.min(100, Math.max(0, totals.percent))}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-muted">{t.marksBlurb}</p>
      </section>

      <ul className="flex flex-col gap-2">
        {totals.subjects.map((subject) => {
          const name =
            totals.language === "am" ? subject.nameAm : subject.nameEn;
          const isEditing = editing === subject.slug;
          return (
            <li key={subject.slug} className="cab p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{name}</span>
                <span className="font-mono text-sm">
                  {subject.score === null
                    ? t.marksNoneYet
                    : `${subject.score}/${subject.maxMarks}`}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  {subject.score === null
                    ? ""
                    : subject.source === "manual"
                      ? t.marksManual
                      : t.marksFromMock}
                </span>
                <button
                  type="button"
                  className="font-mono text-[11px] uppercase tracking-wider text-accent underline"
                  onClick={() => setEditing(isEditing ? null : subject.slug)}
                >
                  {isEditing ? t.marksCancel : t.marksAddResult}
                </button>
                {subject.source === "manual" && subject.entryId && (
                  <button
                    type="button"
                    className="font-mono text-[11px] uppercase tracking-wider text-muted underline"
                    onClick={() =>
                      void deleteMarkEntry({
                        ...auth,
                        markEntryId: subject.entryId as Id<"markEntries">,
                      })
                    }
                  >
                    {t.marksDelete}
                  </button>
                )}
              </div>

              {isEditing && (
                <ManualEntry
                  maxMarks={subject.maxMarks}
                  initialScore={subject.score}
                  onCancel={() => setEditing(null)}
                  onSave={async (score, label) => {
                    await upsertManualMark({
                      ...auth,
                      subjectSlug: subject.slug,
                      score,
                      label: label?.trim() || undefined,
                    });
                    setEditing(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>

      {totals.gradedCount === 0 && (
        <p className="cab p-5 font-mono text-sm text-muted">
          {t.marksEmptyDesc}
        </p>
      )}
    </main>
  );
}

function ManualEntry({
  maxMarks,
  initialScore,
  onCancel,
  onSave,
}: {
  maxMarks: number;
  initialScore: number | null;
  onCancel: () => void;
  onSave: (score: number, label?: string) => Promise<void>;
}) {
  const t = useAppCopy();
  const [value, setValue] = useState(initialScore === null ? "" : String(initialScore));
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    parsed <= maxMarks;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      <label className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {t.marksScoreLabel} {t.marksOutOfLabel} {maxMarks}
      </label>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={maxMarks}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full"
        disabled={busy}
      />
      <input
        type="text"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={t.marksLabelPlaceholder}
        className="w-full"
        disabled={busy}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary flex-1"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(parsed, label);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.marksSave}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={busy}
        >
          {t.marksCancel}
        </button>
      </div>
    </div>
  );
}