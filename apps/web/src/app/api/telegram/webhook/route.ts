import { getWebhookHandler } from "@/lib/bot";
import { getWebhookSecret } from "@/lib/bot/webhook-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("TELEGRAM_BOT_TOKEN is not configured", { status: 503 });
  }

  // Initialize the bot first so it registers the webhook secret with Telegram
  // (setWebhook). This lets a freshly deployed instance self-heal: the first
  // request may 401, Telegram retries, and subsequent requests pass.
  const handler = getWebhookHandler();

  const secret = getWebhookSecret();
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (!timingSafeEqual(header, secret)) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    return await handler(request);
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("Webhook handler failed", { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "telegram-webhook",
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    secured: Boolean(getWebhookSecret()),
  });
}
