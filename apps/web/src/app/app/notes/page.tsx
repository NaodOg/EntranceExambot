"use client";

import { useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useTelegramId } from "@/hooks/useTelegramId";
import { useAppCopy } from "@/lib/i18n/CopyProvider";

export default function NotesPage() {
  const { userArg } = useTelegramId();
  const profile = useQuery(api.users.getByTelegramId, userArg);
  const t = useAppCopy(profile?.language ?? "en");

  return (
    <main className="flex flex-col gap-5 p-4 pt-6">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink"
      >
        <ArrowLeft size={14} /> {t.backHome}
      </Link>

      <header>
        <p className="kicker">{t.notesKicker}</p>
        <h1 className="font-mono mt-2 text-3xl font-bold tracking-wide">
          {t.notesTitle.toUpperCase()}
        </h1>
      </header>

      <section className="cab flex flex-col items-center gap-3 px-5 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center border border-accent bg-accent/10 text-accent">
          <BookOpen size={22} />
        </div>
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-accent">
          {t.notesSoonBadge}
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-muted">{t.notesComingSoon}</p>
      </section>
    </main>
  );
}
