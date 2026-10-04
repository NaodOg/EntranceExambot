export type ThemeName =
  | "midnight"
  | "crt"
  | "obsidian"
  | "paper"
  | "snow"
  | "sand";

export type AccentName = "gold" | "ember" | "sage" | "clay" | "azure" | "violet";
export type FontSizeName = "sm" | "md" | "lg";

export type ThemeDef = {
  id: ThemeName;
  label: string;
  hint: string;
  mode: "dark" | "light";
  preview: { bg: string; surface: string; ink: string };
};

export type AccentDef = {
  id: AccentName;
  label: string;
  hex: string;
};

export const ACCENTS: AccentDef[] = [
  { id: "azure", label: "Azure", hex: "#3d9be8" },
  { id: "gold", label: "Lamp gold", hex: "#e8b84a" },
  { id: "ember", label: "Ember", hex: "#e07a3d" },
  { id: "sage", label: "Sage", hex: "#4aa37d" },
  { id: "clay", label: "Clay", hex: "#c45c3e" },
  { id: "violet", label: "Violet", hex: "#9b6bff" },
];

export const THEMES: ThemeDef[] = [
  { id: "obsidian", label: "Obsidian", hint: "Cool slate night", mode: "dark", preview: { bg: "#0a0e16", surface: "#172033", ink: "#e8eef8" } },
  { id: "midnight", label: "Midnight", hint: "Lamp-lit hall", mode: "dark", preview: { bg: "#07080c", surface: "#141820", ink: "#f4ede3" } },
  { id: "crt", label: "CRT", hint: "Arcade phosphor tube", mode: "dark", preview: { bg: "#030807", surface: "#0c1814", ink: "#e8f6ee" } },
  { id: "paper", label: "Paper", hint: "Warm booklet", mode: "light", preview: { bg: "#ebe3d4", surface: "#fffdf8", ink: "#1c1812" } },
  { id: "snow", label: "Snow", hint: "Clean daylight", mode: "light", preview: { bg: "#e4eaf1", surface: "#ffffff", ink: "#14181e" } },
  { id: "sand", label: "Sand", hint: "Sun-baked page", mode: "light", preview: { bg: "#ddcba8", surface: "#faf3e0", ink: "#2a1c10" } },
];

const THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));
const ACCENT_IDS = new Set<string>(ACCENTS.map((accent) => accent.id));

export function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function normalizeHex(value: string): string | null {
  const raw = value.trim();
  const short = raw.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  return null;
}

export function accentInk(hex: string): string {
  const normalized = normalizeHex(hex) ?? "#3d9be8";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#1a1408" : "#f4ede3";
}

export function accentHex(accent: string): string {
  const named = ACCENTS.find((item) => item.id === accent);
  if (named) return named.hex;
  return normalizeHex(accent) ?? ACCENTS[0].hex;
}

export function isNamedAccent(accent: string): accent is AccentName {
  return ACCENT_IDS.has(accent);
}

export function canonicalTheme(
  theme: string,
  telegramScheme?: "light" | "dark",
): ThemeName {
  if (theme === "dark") return "obsidian";
  if (theme === "light") return "paper";
  if (theme === "telegram") return telegramScheme === "light" ? "paper" : "obsidian";
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "paper";
    }
    return "obsidian";
  }
  if (THEME_IDS.has(theme)) return theme as ThemeName;
  return "obsidian";
}

export function canonicalAccent(accent: string): string {
  if (isNamedAccent(accent)) return accent;
  return normalizeHex(accent) ?? "azure";
}

export type StoredLook = {
  theme: string;
  accent: string;
  ink?: string;
};

export const LOOK_COOKIE = "exitplan-look";
const LOOK_STORAGE_KEY = "exitplan:look";

export function parseStoredLook(raw: string | null | undefined): StoredLook | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { theme?: unknown; accent?: unknown; ink?: unknown };
    const theme =
      typeof parsed.theme === "string" && THEME_IDS.has(parsed.theme) ? parsed.theme : "obsidian";
    if (typeof parsed.accent !== "string") return { theme, accent: "azure" };
    if (isNamedAccent(parsed.accent)) return { theme, accent: parsed.accent };
    const hex = normalizeHex(parsed.accent);
    if (!hex) return { theme, accent: "azure" };
    const ink =
      typeof parsed.ink === "string" ? normalizeHex(parsed.ink) ?? accentInk(hex) : accentInk(hex);
    return { theme, accent: hex, ink };
  } catch {
    return null;
  }
}

export function lookHtmlAttrs(look: StoredLook | null): {
  "data-theme"?: string;
  "data-accent"?: string;
  style?: { "--accent": string; "--accent-ink": string };
} {
  if (!look) return {};
  if (look.accent.startsWith("#")) {
    return {
      "data-theme": look.theme,
      "data-accent": "custom",
      style: {
        "--accent": look.accent,
        "--accent-ink": look.ink ?? accentInk(look.accent),
      },
    };
  }
  return {
    "data-theme": look.theme,
    "data-accent": look.accent,
  };
}

function persistLook(look: StoredLook) {
  const payload = JSON.stringify({
    theme: look.theme,
    accent: look.accent,
    ink: look.accent.startsWith("#") ? look.ink ?? accentInk(look.accent) : undefined,
  });
  try {
    localStorage.setItem(LOOK_STORAGE_KEY, payload);
  } catch {
    /* ignore */
  }
  try {
    const secure = location.protocol === "https:" ? ";secure" : "";
    document.cookie = `${LOOK_COOKIE}=${encodeURIComponent(payload)};path=/;max-age=31536000;samesite=lax${secure}`;
  } catch {
    /* ignore */
  }
}

export function applyAppearance(options: {
  theme: string;
  accent: string;
  fontSize?: FontSizeName;
  reduceMotion?: boolean;
  telegramScheme?: "light" | "dark";
}) {
  const root = document.documentElement;
  const theme = canonicalTheme(options.theme, options.telegramScheme);
  const accent = canonicalAccent(options.accent);
  const named = isNamedAccent(accent);
  const ink = named ? undefined : accentInk(accent);
  const nextAccentAttr = named ? accent : "custom";
  const currentAccentAttr = root.getAttribute("data-accent");
  const currentCustom = root.style.getPropertyValue("--accent").trim().toLowerCase();
  const alreadyApplied =
    root.getAttribute("data-theme") === theme &&
    currentAccentAttr === nextAccentAttr &&
    (named ? currentCustom === "" : currentCustom === accent);

  persistLook({ theme, accent, ink });

  if (alreadyApplied) {
    root.setAttribute("data-size", options.fontSize ?? "md");
    root.setAttribute("data-reduce-motion", options.reduceMotion ? "true" : "false");
    return;
  }

  root.setAttribute("data-theme-switching", "true");
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-size", options.fontSize ?? "md");
  root.setAttribute("data-reduce-motion", options.reduceMotion ? "true" : "false");

  if (named) {
    root.setAttribute("data-accent", accent);
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-ink");
  } else {
    root.setAttribute("data-accent", "custom");
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-ink", ink!);
  }

  requestAnimationFrame(() => {
    root.removeAttribute("data-theme-switching");
  });
}

export const RESTORE_LOOK_SCRIPT = `(function(){try{var s=localStorage.getItem("exitplan:look");if(!s)return;var o=JSON.parse(s);var r=document.documentElement;if(o.theme)r.setAttribute("data-theme",o.theme);if(!o.accent)return;if(o.accent.charAt(0)==="#"){r.setAttribute("data-accent","custom");r.style.setProperty("--accent",o.accent);var ink=o.ink;if(!ink){var h=o.accent,R=parseInt(h.slice(1,3),16),G=parseInt(h.slice(3,5),16),B=parseInt(h.slice(5,7),16);ink=((0.2126*R+0.7152*G+0.0722*B)/255)>0.58?"#1a1408":"#f4ede3";}r.style.setProperty("--accent-ink",ink);}else{r.setAttribute("data-accent",o.accent);r.style.removeProperty("--accent");r.style.removeProperty("--accent-ink");}document.cookie="exitplan-look="+encodeURIComponent(s)+";path=/;max-age=31536000;samesite=lax"+(location.protocol==="https:"?";secure":"");}catch(e){}})();`;

export function playTone(kind: "correct" | "wrong" | "tap") {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  osc.type = kind === "wrong" ? "sawtooth" : "sine";
  osc.frequency.value = kind === "correct" ? 660 : kind === "wrong" ? 180 : 420;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "tap" ? 0.08 : 0.18));
  osc.start(now);
  osc.stop(now + 0.2);
}
