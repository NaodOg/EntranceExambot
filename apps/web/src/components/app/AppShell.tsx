"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@/lib/authed-convex";
import { api } from "convex/_generated/api";
import { useTelegramId } from "@/hooks/useTelegramId";
import { applyAppearance } from "@/lib/theme";
import { Lang } from "@/lib/copy";
import { useAppCopy } from "@/lib/i18n/CopyProvider";
import { Onboarding } from "@/components/app/Onboarding";
import { BottomNav } from "@/components/app/BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { telegramId, user, isReady, colorScheme, userArg, startParam } = useTelegramId();
  const upsertUser = useMutation(api.users.getOrCreateFromTelegram);
  const profile = useQuery(api.users.getByTelegramId, userArg);

  useEffect(() => {
    if (!isReady || !startParam) return;
    if (startParam === "duel_lobby") {
      if (pathname !== "/app/duel") {
        router.replace("/app/duel");
      }
      return;
    }
    if (startParam.startsWith("duel_")) {
      const code = startParam.slice(5).toUpperCase();
      if (code && pathname !== `/app/duel/${code}`) {
        router.replace(`/app/duel/${code}`);
      }
    }
  }, [isReady, startParam, pathname, router]);

  useEffect(() => {
    if (!isReady || profile === undefined) return;
    const usernameChanged =
      user?.username !== undefined && user.username !== profile?.username;
    const firstNameChanged =
      user?.first_name !== undefined && user.first_name !== profile?.firstName;
    if (profile !== null && !usernameChanged && !firstNameChanged) return;
    void upsertUser({
      telegramId,
      username: user?.username,
      firstName: user?.first_name,
      language: user?.language_code === "am" ? "am" : "en",
    }).catch(() => {
      /* profile upsert is retried on next render */
    });
  }, [upsertUser, telegramId, user, isReady, profile]);

  useEffect(() => {
    if (!profile?.onboardingComplete) return;
    applyAppearance({
      theme: profile.theme,
      accent: profile.accent,
      fontSize: profile.fontSize,
      reduceMotion: profile.reduceMotion,
      telegramScheme: colorScheme,
    });
  }, [profile, colorScheme]);

  const lang: Lang = profile?.language ?? "en";
  const hideNav =
    pathname.startsWith("/app/exam") ||
    pathname.startsWith("/app/lab") ||
    (pathname.startsWith("/app/duel/") && pathname.length > "/app/duel/".length);
  const isDuelRoom =
    pathname.startsWith("/app/duel/") && pathname.length > "/app/duel/".length;

  // Outside Telegram there is no signed initData, so no data can be fetched.
  // Block the app outright in production to keep the Mini App Telegram-only.
  if (isReady && !user && process.env.NODE_ENV === "production") {
    return <OpenInTelegram />;
  }

  if (profile?.isBanned) {
    return <BannedScreen lang={lang} reason={profile.banReason} />;
  }

  const needsOnboarding =
    profile !== undefined && !profile?.onboardingComplete && !isDuelRoom;

  if (needsOnboarding) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <Onboarding
          telegramId={telegramId || "dev-user"}
          profile={profile ?? {
            language: "en" as const,
            theme: "obsidian",
            accent: "azure",
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <div className={hideNav ? "flex-1" : "flex-1 pb-24"}>{children}</div>
      {!hideNav && (
        <BottomNav lang={lang} haptics={profile?.hapticsEnabled ?? true} />
      )}
    </div>
  );
}

function OpenInTelegram() {
  const t = useAppCopy();
  const bot =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "EntranceExamStudybot";
  return (
    <main className="tg-gate mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="kicker">{t.shellTelegramOnly}</p>
      <h1 className="font-display text-4xl">{t.shellOpenInTelegram}</h1>
      <p className="text-sm text-muted">{t.shellOpenInTelegramBody}</p>
      <a href={`https://t.me/${bot}`} className="btn btn-primary w-full max-w-xs">
        {t.shellOpenBot}
      </a>
    </main>
  );
}

function BannedScreen({ lang, reason }: { lang: Lang; reason?: string }) {
  const en = lang !== "am";
  return (
    <main className="tg-gate mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="kicker">{en ? "Access suspended" : "መዳረሻ ተዘግቷል"}</p>
      <h1 className="font-display text-4xl">
        {en ? "Account suspended" : "መለያህ በእገጋ ተቋርጧል"}
      </h1>
      <p className="text-sm text-muted">
        {en
          ? reason
            ? `Reason: ${reason}`
            : "Your account has been suspended. If you think this is a mistake, contact support."
          : reason
            ? `ምክንያት፦ ${reason}`
            : "መለያህ በእገጋ ተቋርጧል። ስህተት ሆኖ ካየህ ደጋፊዎቻችንን አግኝ።"}
      </p>
      <a
        href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "EntranceExamStudybot"}`}
        className="btn btn-primary w-full max-w-xs"
      >
        {en ? "Contact support" : "ደጋፊ አግኝ"}
      </a>
    </main>
  );
}
