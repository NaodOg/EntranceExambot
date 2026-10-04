"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { clearAdminToken } from "@/lib/admin-client";
import { AdminErrorBoundary } from "./AdminErrorBoundary";
import {
  BookOpen,
  ClipboardList,
  Compass,
  Flag,
  Languages,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const GROUPS = [
  {
    label: null,
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/tracks", label: "Tracks", icon: Compass },
        { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
      { href: "/admin/exams", label: "Exams", icon: BookOpen },
      { href: "/admin/questions", label: "Questions", icon: ClipboardList },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/premium", label: "Premium", icon: Sparkles },
      { href: "/admin/reports", label: "Reports", icon: Flag },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/notifications", label: "Broadcasts", icon: Megaphone },
      { href: "/admin/links", label: "Tracked links", icon: Link2 },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/translations", label: "Translations", icon: Languages },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    clearAdminToken();
    window.location.href = "/admin/login";
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg-elevated lg:flex">
        <div className="px-4 py-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <Nav pathname={pathname} />
        </div>
        <div className="border-t border-line p-3">
          <button type="button" onClick={() => void logout()} className="btn btn-ghost w-full">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-3 py-2.5 backdrop-blur-xl lg:hidden">
        <Brand compact />
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative flex h-full w-72 max-w-[85%] flex-col border-r border-line bg-bg-elevated">
            <div className="flex items-center justify-between px-4 py-4">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              <Nav pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-line p-3">
              <button type="button" onClick={() => void logout()} className="btn btn-ghost w-full">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-6">
          <AdminErrorBoundary>{children}</AdminErrorBoundary>
        </div>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/admin" className="block">
      <p className="kicker">Control room</p>
      {!compact ? <h1 className="font-display mt-0.5 text-2xl">MatricPrep</h1> : null}
    </Link>
  );
}

function Nav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="grid gap-5">
      {GROUPS.map((group, groupIndex) => (
        <div key={group.label ?? `group-${groupIndex}`} className="grid gap-1">
          {group.label ? (
            <p className="px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 ${
                  active ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
