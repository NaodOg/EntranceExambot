/**
 * Minimal Telegram Bot API client for Convex actions.
 *
 * Broadcasts are sent from Convex scheduled actions (so no external cron is
 * required). The bot token is read from the Convex deployment environment,
 * matching the value already used by `convex/lib/auth.ts`.
 */

export type TgInlineButton =
  | { text: string; url: string }
  | { text: string; web_app: { url: string } }
  | { text: string; callback_data: string };

export type TgInlineKeyboard = TgInlineButton[][];

export type TgSendResult =
  | { ok: true }
  | { ok: false; retryAfter?: number; description?: string; errorCode?: number };

function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

export function hasBotToken(): boolean {
  return Boolean(botToken());
}

async function callTelegram(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: TgApiResponse }> {
  const token = botToken();
  if (!token) {
    return { ok: false, status: 0, json: { ok: false, description: "No bot token" } };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json: TgApiResponse = {};
  try {
    json = (await res.json()) as TgApiResponse;
  } catch {
    json = { ok: false, description: "Invalid Telegram response" };
  }

  return { ok: res.ok && json.ok === true, status: res.status, json };
}

type TgApiResponse = {
  ok?: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
};

/** Sends one HTML message with an optional inline keyboard. */
export async function tgSendMessage(params: {
  chatId: string;
  text: string;
  inlineKeyboard?: TgInlineKeyboard;
  disablePreview?: boolean;
}): Promise<TgSendResult> {
  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.text,
    parse_mode: "HTML",
  };
  if (params.inlineKeyboard?.length) {
    body.reply_markup = { inline_keyboard: params.inlineKeyboard };
  }
  if (params.disablePreview) {
    body.link_preview_options = { is_disabled: true };
  }

  const { ok, json } = await callTelegram("sendMessage", body);
  if (ok) return { ok: true };
  return {
    ok: false,
    retryAfter: json.parameters?.retry_after,
    description: json.description,
    errorCode: json.error_code,
  };
}
