export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string | undefined>;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
  openLink: (url: string) => void;
  sendData: (data: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.Telegram?.WebApp ?? null;
}

export function applyTelegramTheme() {
  const webApp = getTelegramWebApp();
  if (!webApp) {
    return;
  }

  const root = document.documentElement;
  const params = webApp.themeParams;

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      root.style.setProperty(`--tg-theme-${key.replace(/_/g, "-")}`, value);
    }
  }

  root.style.setProperty("--tg-bg", params.bg_color ?? "#17212b");
  root.style.setProperty("--tg-text", params.text_color ?? "#ffffff");
  root.style.setProperty("--tg-button", params.button_color ?? "#5288c1");
  root.style.setProperty("--tg-button-text", params.button_text_color ?? "#ffffff");
  root.style.setProperty("--tg-hint", params.hint_color ?? "#708499");
}

export function haptic(type: "light" | "medium" | "heavy" = "light") {
  getTelegramWebApp()?.HapticFeedback.impactOccurred(type);
}

export function hapticSuccess() {
  getTelegramWebApp()?.HapticFeedback.notificationOccurred("success");
}

export function hapticError() {
  getTelegramWebApp()?.HapticFeedback.notificationOccurred("error");
}
