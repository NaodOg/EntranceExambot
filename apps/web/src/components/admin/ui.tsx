"use client";

import { ReactNode, useState } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="kicker">{kicker}</p>
        <h2 className="font-display mt-1.5 text-3xl sm:text-4xl">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={`cab p-4 sm:p-5 ${className}`}>{children}</Tag>;
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-display text-xl sm:text-2xl">{children}</h3>
      {aside}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="cab p-4">
      <p className="kicker">{label}</p>
      <p className="font-display mt-1 text-3xl">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const TONES = {
  muted: "bg-surface-2 text-muted",
  accent: "bg-accent/15 text-accent",
  danger: "bg-danger/15 text-danger",
  sage: "bg-sage/15 text-sage",
} as const;

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="surface grid place-items-center gap-1 px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {description ? <p className="text-sm text-muted">{description}</p> : null}
    </div>
  );
}

export type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

export function LoadMore({
  status,
  loadMore,
  count,
  pageSize = 10,
}: {
  status: PaginationStatus;
  loadMore: (numItems: number) => void;
  count: number;
  pageSize?: number;
}) {
  if (status === "LoadingFirstPage") {
    return <p className="py-5 text-center text-sm text-muted">Loading…</p>;
  }
  if (status === "Exhausted") {
    return count > pageSize ? (
      <p className="py-3 text-center font-mono text-[11px] uppercase tracking-wider text-faint">
        End · {count} shown
      </p>
    ) : null;
  }
  return (
    <button
      type="button"
      className="btn btn-ghost w-full"
      disabled={status === "LoadingMore"}
      onClick={() => loadMore(pageSize)}
    >
      {status === "LoadingMore" ? "Loading…" : `Load ${pageSize} more`}
    </button>
  );
}

/** Renders a long in-memory list in fixed-size batches with a "show more" control. */
export function Batched<T>({
  items,
  size = 10,
  renderItem,
  empty,
}: {
  items: T[];
  size?: number;
  renderItem: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
}) {
  const [count, setCount] = useState(size);
  if (items.length === 0) return <>{empty}</>;
  const visible = items.slice(0, count);
  const remaining = items.length - visible.length;
  return (
    <div className="grid gap-3">
      {visible.map((item, index) => renderItem(item, index))}
      {remaining > 0 ? (
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => setCount((current) => current + size)}
        >
          Show {Math.min(size, remaining)} more · {remaining} left
        </button>
      ) : null}
    </div>
  );
}
