"use client";

import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { PageHeaderSkeleton, StageListSkeleton } from "@/components/ui/Skeleton";

export default function HistoryPage() {
  const { userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const [limit, setLimit] = useState(10);
  const page = useQuery(
    api.exams.listMyAttempts,
    userArg === "skip" ? "skip" : { ...userArg, limit },
  );
  const t = useAppCopy(profile?.language ?? "en");

  if (page === undefined) {
    return (
      <main className="flex flex-col gap-4 p-4 pt-6 is-skeleton">
        <PageHeaderSkeleton titleWidth="w-48" />
        <StageListSkeleton rows={6} />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4 pt-6">
      <header>
        <p className="kicker">{t.history}</p>
        <h1 className="font-mono mt-2 text-3xl font-bold tracking-wide">
          {t.scoreboard.toUpperCase()}
        </h1>
      </header>
      {page.items.map((attempt) => (
        <Link
          key={attempt._id}
          href={`/app/review?attempt=${attempt._id}`}
          className="stage-row"
        >
          <span>
            <b>{attempt.examTitle.toUpperCase()}</b>
            <small>
              {new Date(attempt.completedAt).toLocaleString()} · {attempt.durationSec}
              {t.progSecondsUnit}
            </small>
          </span>
          <em>{attempt.percent}%</em>
        </Link>
      ))}
      {page.hasMore && (
        <button
          type="button"
          onClick={() => setLimit((value) => value + 10)}
          className="btn btn-ghost w-full"
        >
          {t.showMore}
        </button>
      )}
      {!page.items.length && (
        <p className="font-mono text-sm text-muted">{t.progNoSittings}</p>
      )}
    </main>
  );
}
