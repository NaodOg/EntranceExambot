import { createHash } from "crypto";

/**
 * Secret used to authenticate incoming Telegram webhook requests.
 * Prefers an explicit TELEGRAM_WEBHOOK_SECRET, otherwise derives a stable
 * secret from the bot token so the webhook is protected without extra config.
 */
export function getWebhookSecret(): string | null {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (explicit) return explicit;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  return createHash("sha256").update(`exam-bot-webhook:${token}`).digest("hex");
}
