"use client";

import { useMemo } from "react";
import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { HomeModel, SAMPLE_HOME } from "@/components/home/types";

export function useHome(): { model: HomeModel; ready: boolean } {
  const { telegramId, user, userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const tracks = useQuery(api.exams.listPublishedTracks);
  const subjects = useQuery(
    api.exams.listPublishedSubjects,
    profile?.trackSlug ? { trackSlug: profile.trackSlug } : "skip",
  );
  const attempts = useQuery(
    api.exams.listMyAttempts,
    userArg === "skip" ? "skip" : { ...userArg, limit: 3 },
  );
  const startOfDay = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }, []);
  const dailyQuota = useQuery(
    api.exams.getDailyQuota,
    telegramId ? { telegramId, todayStartMs: startOfDay } : "skip",
  );
  const ready =
    profile !== undefined &&
    attempts !== undefined &&
    (!telegramId || dailyQuota !== undefined);

  const language = (profile?.language === "am" ? "am" : "en") as "am" | "en";
  const t = useAppCopy(language);

  const model = useMemo(() => {
    const trackSlug = profile?.trackSlug ?? SAMPLE_HOME.trackSlug;
    const track = (tracks ?? []).find((row) => row.slug === trackSlug);
    // Home links must carry a real subject slug, not the track.
    const subjectSlug =
      profile?.subjectSlugs?.find((slug) =>
        (subjects ?? []).some((row) => row.slug === slug),
      ) ?? subjects?.[0]?.slug ?? SAMPLE_HOME.subjectSlug;
    const subject = (subjects ?? []).find((row) => row.slug === subjectSlug);
    const list = attempts?.items ?? [];
    const isPro = profile?.isProActive ?? dailyQuota?.isPro ?? false;
    const todayDone = dailyQuota?.questionsToday ?? 0;
    const freeQuestionsLeft = isPro ? Infinity : (dailyQuota?.freeQuestionsLeft ?? 20);
    const freeQuestionsMax = dailyQuota?.freeQuestionsMax ?? 20;
    const freeDuelsLeft = isPro ? Infinity : (dailyQuota?.freeDuelsLeft ?? 0);
    const freeDuelsMax = dailyQuota?.freeDuelsMax ?? 0;
    const duelsToday = dailyQuota?.duelsToday ?? 0;
    const usageToday = dailyQuota?.usageToday ?? [];
    const last = list[0];
    const sittings = list.slice(0, 3).map((a) => ({
      percent: a.percent,
      title: a.examTitle ?? t.homeFallbackTitle,
      reviewHref: `/app/review?attempt=${a._id}`,
    }));

    return {
      language,
      name: profile?.firstName ?? user?.first_name ?? SAMPLE_HOME.name,
      trackName: track?.nameEn ?? SAMPLE_HOME.trackName,
      trackSlug,
      subjectName:
        language === "am"
          ? subject?.nameAm || subject?.nameEn || SAMPLE_HOME.subjectName
          : subject?.nameEn ?? SAMPLE_HOME.subjectName,
      subjectSlug,
      streak: profile?.streakCount ?? 0,
      xp: profile?.xp ?? 0,
      dailyGoal: profile?.dailyGoal ?? SAMPLE_HOME.dailyGoal,
      todayDone,
      freeQuestionsLeft,
      freeQuestionsMax,
      freeDuelsLeft,
      freeDuelsMax,
      duelsToday,
      usageToday,
      isPro,
      lastPercent: last?.percent ?? null,
      lastTitle: last?.examTitle ?? SAMPLE_HOME.lastTitle,
      lastReviewHref: last ? `/app/review?attempt=${last._id}` : null,
      examYear: profile?.examYear ?? SAMPLE_HOME.examYear,
      mockCount: SAMPLE_HOME.mockCount,
      mockMinutes: SAMPLE_HOME.mockMinutes,
      sittings,
      examHref: `/app/exam?subject=${subjectSlug}`,
      quickHref: `/app/exam?subject=${subjectSlug}&mode=quick`,
      proHref: "/app/pro",
      historyHref: "/app/history",
      practiceHref: "/app/practice",
    };
  }, [profile, tracks, subjects, attempts, user, dailyQuota, language, t]);

  return { model, ready };
}
