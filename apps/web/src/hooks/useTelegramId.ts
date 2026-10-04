"use client";

import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";

export function useTelegramId() {
  const { user, isReady, startParam, colorScheme } = useTelegramWebApp();
  const allowDevFallback = process.env.NODE_ENV !== "production";
  const telegramId = user
    ? String(user.id)
    : isReady && allowDevFallback
      ? "dev-user"
      : "";
  return {
    telegramId,
    user,
    isReady,
    startParam,
    colorScheme,
    isDevPreview: isReady && !user && allowDevFallback,
    userArg: telegramId ? { telegramId } : ("skip" as const),
  };
}
