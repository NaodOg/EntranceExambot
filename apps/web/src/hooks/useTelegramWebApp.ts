"use client";

/* eslint-disable react-hooks/set-state-in-effect -- syncing with the Telegram WebApp external system on mount */

import { useEffect, useState } from "react";
import {
  applyTelegramTheme,
  getTelegramWebApp,
  TelegramWebApp,
  TelegramWebAppUser,
} from "@/lib/telegram";

export function useTelegramWebApp() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramWebAppUser | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const app = getTelegramWebApp();
    if (!app) {
      setIsReady(true);
      return;
    }

    app.ready();
    app.expand();
    applyTelegramTheme();
    setWebApp(app);
    setUser(app.initDataUnsafe.user ?? null);
    setStartParam(app.initDataUnsafe.start_param ?? null);
    setIsReady(true);
  }, []);

  return {
    webApp,
    user,
    startParam,
    isReady,
    initData: webApp?.initData ?? "",
    colorScheme: webApp?.colorScheme ?? "dark",
  };
}
