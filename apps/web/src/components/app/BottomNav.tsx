"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock3, Home, Layers3, Sparkles, UserRound } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { Lang } from "@/lib/copy";
import { useAppCopy } from "@/lib/i18n/CopyProvider";

const NAV = [
  { href: "/app", icon: Home, key: "home" as const },
  { href: "/app/practice", icon: Layers3, key: "exams" as const },
  { href: "/app/history", icon: Clock3, key: "history" as const },
  { href: "/app/pro", icon: Sparkles, key: "pro" as const },
  { href: "/app/account", icon: UserRound, key: "account" as const },
];

const PREFETCH = [
  ...NAV.map((item) => item.href),
  "/app/duel",
  "/app/mistakes",
  "/app/leaderboard",
  "/app/totals",
];

function navActive(current: string, href: string) {
  return href === "/app" ? current === "/app" : current.startsWith(href);
}

export function BottomNav({ lang, haptics = true }: { lang: Lang; haptics?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const t = useAppCopy(lang);
  const shown = pendingHref ?? pathname;
  const pending = pendingHref != null && !navActive(pathname, pendingHref);

  useEffect(() => {
    if (pendingHref && navActive(pathname, pendingHref)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  useEffect(() => {
    for (const href of PREFETCH) {
      router.prefetch(href);
    }
  }, [router]);

  function go(href: string) {
    router.prefetch(href);
    if (haptics) haptic("light");
    if (navActive(pathname, href)) return;

    setPendingHref(href);
    router.push(href);
  }

  return (
    <nav className="nav-blur fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-2 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2">
      {pending ? <span className="nav-pending" aria-hidden /> : null}
      <div className="grid grid-cols-5">
        {NAV.map((item) => {
          const active = navActive(shown, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={`nav-item ${active ? "is-on" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(item.href);
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 1.7} />
              {t[item.key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
