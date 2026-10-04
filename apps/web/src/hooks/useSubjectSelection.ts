"use client";

import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { useEffect, useState } from "react";
import { useTelegramId } from "@/hooks/useTelegramId";

type Subject = {
  slug: string;
  trackSlug: string;
  nameEn: string;
  nameAm: string;
  maxMarks?: number;
};

type Track = { slug: string; nameEn: string; nameAm: string };

/**
 * Resolves which subject a subject-scoped screen should act on.
 *
 * Precedence: an explicit `?subject=` deep link, then the student's saved
 * onboarding picks, then the first published subject in their track. Keeping
 * this in one place stops each screen inventing its own fallback and drifting
 * back to treating a track slug as if it were a subject.
 */
export function useSubjectSelection() {
  const { userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const tracks = useQuery(api.exams.listPublishedTracks);

  const trackSlug: string | undefined = profile?.trackSlug ?? tracks?.[0]?.slug;

  const subjects = useQuery(
    api.exams.listPublishedSubjects,
    trackSlug ? { trackSlug } : "skip",
  );

  const [requested, setRequested] = useState<string | undefined>(undefined);
  const [override, setOverride] = useState<string | undefined>(undefined);

  // Deep-link support, read once on mount.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("subject");
    if (param) setRequested(param);
  }, []);

  const slug = pickSubjectSlug({
    override,
    requested,
    saved: profile?.subjectSlugs,
    subjects,
  });

  const subject = subjects?.find((row) => row.slug === slug);

  return {
    tracks,
    subjects,
    trackSlug,
    slug,
    subject,
    selectSubject: setOverride,
  };
}

function pickSubjectSlug({
  override,
  requested,
  saved,
  subjects,
}: {
  override?: string;
  requested?: string;
  saved?: string[];
  subjects: Subject[] | undefined;
}): string | undefined {
  if (!subjects || subjects.length === 0) return undefined;
  const pick = (candidate?: string) =>
    candidate && subjects.some((row) => row.slug === candidate) ? candidate : undefined;
  return (
    pick(override) ?? pick(requested) ?? pick(saved?.[0]) ?? subjects[0]?.slug
  );
}

export type { Subject, Track };