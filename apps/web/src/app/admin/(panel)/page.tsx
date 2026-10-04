"use client";

import Link from "next/link";
import { useMemo } from "react";
import { api } from "convex/_generated/api";
import { useAdminQuery } from "@/lib/admin-client";
import { PageHeader } from "@/components/admin/ui";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Compass,
  Flag,
  Languages,
  Link2,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

const LINKS = [
  { href: "/admin/tracks", label: "Tracks", desc: "Study tracks", icon: Compass },
        { href: "/admin/subjects", label: "Subjects", desc: "Examinable subjects", icon: BookOpen },
  { href: "/admin/exams", label: "Exams", desc: "Papers & mocks", icon: BookOpen },
  { href: "/admin/questions", label: "Questions", desc: "Question bank", icon: ClipboardList },
  { href: "/admin/users", label: "Users", desc: "Students & access", icon: Users },
  { href: "/admin/links", label: "Tracked links", desc: "Campaigns & tracking", icon: Link2 },
  { href: "/admin/translations", label: "Translations", desc: "App & bot copy", icon: Languages },
  { href: "/admin/settings", label: "Settings", desc: "Pricing & rules", icon: Settings },
];

export default function AdminOverviewPage() {
  const nowMs = useMemo(() => Date.now(), []);
  const stats = useAdminQuery(api.users.getStats, { nowMs });

  return (
    <div className="grid gap-5">
      <PageHeader
        kicker="Control room"
        title="Overview"
        description="What needs a decision right now, and the shortcuts to get there."
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <Attention
          href="/admin/premium"
          icon={Sparkles}
          label="Premium requests"
          count={stats?.pendingPremium}
          hint="Awaiting approval"
        />
        <Attention
          href="/admin/reports"
          icon={Flag}
          label="Open reports"
          count={stats?.openReports}
          hint="Flagged questions"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="cab group flex items-center gap-3 p-4 transition-colors hover:border-accent/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{link.label}</span>
                <span className="block text-sm text-muted">{link.desc}</span>
              </span>
              <ArrowRight
                size={16}
                className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function Attention({
  href,
  icon: Icon,
  label,
  count,
  hint,
}: {
  href: string;
  icon: typeof Flag;
  label: string;
  count: number | undefined;
  hint: string;
}) {
  const value = count ?? 0;
  const clear = value === 0;
  return (
    <Link
      href={href}
      className={`cab flex items-center justify-between gap-3 p-4 transition-colors ${
        clear ? "hover:border-line-strong" : "hover:border-accent/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 place-items-center rounded-lg ${
            clear ? "bg-surface-2 text-muted" : "bg-accent/15 text-accent"
          }`}
        >
          <Icon size={20} />
        </span>
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-sm text-muted">{clear ? "All clear" : hint}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-display text-3xl leading-none">{value}</p>
      </div>
    </Link>
  );
}
