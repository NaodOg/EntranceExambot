"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { createHmac } from "crypto";

function validateTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return { valid: false as const, reason: "Missing hash" };
  }

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) {
    return { valid: false as const, reason: "Invalid signature" };
  }

  const authDate = Number(params.get("auth_date") ?? "0");
  const maxAgeSeconds = 60 * 60 * 24;
  if (Date.now() / 1000 - authDate > maxAgeSeconds) {
    return { valid: false as const, reason: "Init data expired" };
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    return { valid: false as const, reason: "Missing user" };
  }

  const user = JSON.parse(userRaw) as {
    id: number;
    username?: string;
    first_name?: string;
    language_code?: string;
  };

  return {
    valid: true as const,
    user: {
      telegramId: String(user.id),
      username: user.username,
      firstName: user.first_name,
      language: user.language_code?.startsWith("am") ? ("am" as const) : ("en" as const),
    },
  };
}

export const validateInitData = action({
  args: { initData: v.string() },
  handler: async (_ctx, args) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    return validateTelegramInitData(args.initData, botToken);
  },
});

export const validateInitDataUnsafeForDev = action({
  args: { initData: v.string() },
  handler: async (_ctx, args) => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Dev-only validation is disabled in production");
    }

    const params = new URLSearchParams(args.initData);
    const userRaw = params.get("user");

    if (!userRaw) {
      return { valid: false as const, reason: "Missing user" };
    }

    const user = JSON.parse(userRaw) as {
      id: number;
      username?: string;
      first_name?: string;
    };

    return {
      valid: true as const,
      user: {
        telegramId: String(user.id),
        username: user.username,
        firstName: user.first_name,
        language: "am" as const,
      },
    };
  },
});
