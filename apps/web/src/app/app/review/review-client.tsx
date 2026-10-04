"use client";

import Link from "next/link";
import { useQuery } from "@/lib/authed-convex";
import { useSearchParams } from "next/navigation";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { Check, X } from "lucide-react";
import { PageHeaderSkeleton, StageListSkeleton } from "@/components/ui/Skeleton";

export default function ReviewPageClient() {
  const searchParams = useSearchParams();
  const { userArg, telegramId } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const attemptId = searchParams.get("attempt") as Id<"attempts"> | null;
  const review = useQuery(
    api.exams.getAttemptReview,
    attemptId && telegramId ? { attemptId, telegramId } : "skip",
  );
  const t = useAppCopy(profile?.language ?? "en");

  if (!attemptId) {
    return (
      <main className="p-4">
        <p className="font-mono text-sm text-muted">{t.progMissingAttempt}</p>
        <Link href="/app" className="btn btn-primary mt-4">
          {t.backHome}
        </Link>
      </main>
    );
  }

  if (review === undefined) {
    return (
      <main className="flex flex-col gap-4 p-4 pt-6 pb-8 is-skeleton">
        <PageHeaderSkeleton titleWidth="w-28" />
        <StageListSkeleton rows={4} />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4 pt-6 pb-8">
      <Link href="/app" className="font-mono text-xs uppercase tracking-wider text-muted">
        ← {t.backHome}
      </Link>
      <header>
        <p className="kicker">{t.review}</p>
        <h1 className="font-mono mt-2 text-3xl font-bold tracking-wide">{t.progReplay}</h1>
      </header>
      {review && (
        <p className="font-mono text-sm tracking-wider text-muted">
          {review.score}/{review.availableMarks ?? review.totalQuestions} · {review.percent}%
        </p>
      )}
      {review?.details.map((item, index) => {
        if (!item?.question) return null;
        return (
          <section key={`${item.questionId}-${index}`} className="cab p-4">
            <p className={`inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase tracking-wider ${item.isCorrect ? "text-sage" : "text-danger"}`}>
              {item.isCorrect ? <Check size={14} /> : <X size={14} />}
              {item.isCorrect ? t.progCorrect : t.progIncorrect} · {item.selectedKey} / {item.question.correctKey}
            </p>
            <p className="mt-2 font-medium">{item.question.textEn}</p>
            <p className="mt-3 text-sm text-muted">{item.question.explanationEn}</p>
          </section>
        );
      })}
    </main>
  );
}
