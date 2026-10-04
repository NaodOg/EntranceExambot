"use client";

import { useAppCopy } from "@/lib/i18n/CopyProvider";

export function Bone({ className = "" }: { className?: string }) {
  return <span className={`sk ${className}`} />;
}

export function PageHeaderSkeleton({ titleWidth = "w-44" }: { titleWidth?: string }) {
  return (
    <header className="grid gap-2">
      <Bone className="h-2.5 w-20" />
      <Bone className={`h-8 ${titleWidth}`} />
    </header>
  );
}

export function StageListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="stage-row">
          <span className="grid flex-1 gap-2">
            <Bone className="h-3 w-40" />
            <Bone className="h-2 w-28" />
          </span>
          <Bone className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

const HOME_MODE_BONES = [
  { label: "w-24", sub: "w-36" },
  { label: "w-28", sub: "w-32" },
  { label: "w-24", sub: "w-40" },
  { label: "w-32", sub: "w-28" },
  { label: "w-32", sub: "w-36" },
  { label: "w-20", sub: "w-28" },
  { label: "w-24", sub: "w-32" },
] as const;

export function HomeSkeleton() {
  const t = useAppCopy();
  return (
    <article className="home home-arcade is-skeleton" aria-busy="true" aria-label={t.shellLoadingHome}>
      <header className="hx-hud">
        <span className="hx-hud-score">
          <Bone className="h-4 w-6" />
          <Bone className="h-6 w-12" />
        </span>
        <span className="hx-hud-title">
          <Bone className="h-6 w-32" />
        </span>
        <span className="hx-hud-hi">
          <Bone className="h-4 w-8" />
          <Bone className="h-6 w-12" />
        </span>
      </header>

      <div className="hx-cab">
        <div className="hx-crt">
          <p className="hx-crt-kicker">
            <Bone className="h-4 w-28" />
            <Bone className="h-4 w-16" />
          </p>
          <h1 aria-hidden className="h-16 leading-none">
            <Bone className="h-full w-[4.6ch]" />
          </h1>
          <nav className="hx-cart" aria-hidden>
            {HOME_MODE_BONES.map((row, index) => (
              <div key={index}>
                <Bone className={`h-6 ${row.label}`} />
                <Bone className={`h-2.5 ${row.sub}`} />
              </div>
            ))}
          </nav>
        </div>

        <section className="hx-stats">
          <div className="hx-stats-head">
            <Bone className="h-4 w-32" />
            <Bone className="h-6 w-[5.5rem]" />
          </div>
          <div className="hx-stats-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="hx-stat-card">
                <Bone className="h-2.5 w-12" />
                <Bone className="h-6 w-10" />
                <Bone className="mt-0.5 h-1 w-full" />
              </div>
            ))}
          </div>
          <div className="hx-stats-recap">
            <Bone className="h-2.5 w-28" />
            <div className="hx-recap-chips">
              <span className="hx-recap-chip">
                <Bone className="h-3 w-8" />
                <Bone className="h-2.5 w-12" />
              </span>
              <span className="hx-recap-chip">
                <Bone className="h-3 w-8" />
                <Bone className="h-2.5 w-12" />
              </span>
            </div>
          </div>
        </section>

        <div className="hx-coin-door cab">
          <div className="hx-coin-door-head">
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-14" />
          </div>
          <div className="hx-coin-door-body">
            <Bone className="h-[58px] w-[58px] shrink-0" />
            <div className="hx-coin-info">
              <Bone className="h-5 w-44 max-w-full" />
              <Bone className="h-3 w-full" />
            </div>
            <Bone className="h-8 w-24 shrink-0" />
          </div>
        </div>
      </div>

      <div className="hx-marquee">
        <Bone className="my-2 h-4 w-full" />
      </div>
    </article>
  );
}

export function AccountSkeleton() {
  const t = useAppCopy();
  return (
    <main className="flex flex-col gap-5 p-4 pt-6 is-skeleton" aria-busy="true" aria-label={t.shellLoadingAccount}>
      <PageHeaderSkeleton titleWidth="w-36" />
      <Bone className="h-12 w-full" />
      <Bone className="h-12 w-full" />
      <Bone className="h-16 w-full" />
      <Bone className="h-28 w-full" />
      <Bone className="h-40 w-full" />
    </main>
  );
}

export function ProSkeleton() {
  const t = useAppCopy();
  return (
    <main className="flex flex-col gap-4 p-4 pt-6 is-skeleton" aria-busy="true" aria-label={t.shellLoadingPro}>
      <div className="cab grid gap-3 p-5">
        <Bone className="h-2.5 w-16" />
        <Bone className="h-8 w-44" />
        <Bone className="h-6 w-24" />
        <Bone className="h-4 w-full" />
        <div className="mt-2 grid gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Bone key={index} className="h-4 w-48" />
          ))}
        </div>
      </div>
      <Bone className="h-48 w-full" />
    </main>
  );
}

export function ExamSkeleton() {
  const t = useAppCopy();
  return (
    <main className="flex flex-col gap-4 p-4 pt-6 is-skeleton" aria-busy="true" aria-label={t.shellLoadingExam}>
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-20" />
        <Bone className="h-3 w-16" />
      </div>
      <Bone className="h-2 w-full" />
      <div className="cab grid gap-3 p-4">
        <Bone className="h-3 w-24" />
        <Bone className="h-6 w-full" />
        <Bone className="h-6 w-4/5" />
      </div>
      <div className="grid gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Bone key={index} className="h-14 w-full" />
        ))}
      </div>
    </main>
  );
}

export function PageSkeleton() {
  const t = useAppCopy();
  return (
    <main className="flex flex-col gap-5 p-4 pt-6 is-skeleton" aria-busy="true" aria-label={t.shellLoading}>
      <PageHeaderSkeleton />
      <Bone className="h-16 w-full" />
      <StageListSkeleton rows={5} />
    </main>
  );
}
