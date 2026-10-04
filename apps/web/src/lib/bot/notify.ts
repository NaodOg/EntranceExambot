import { botCopy, fill, type Lang } from "./copy";
import { esc } from "./html";

const token = process.env.TELEGRAM_BOT_TOKEN;

type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } };

function resolveLang(lang?: string): Lang {
  return lang === "am" ? "am" : "en";
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  buttons?: InlineButton[][],
) {
  if (!token) return { ok: false, error: "No token" };

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };

    if (buttons?.length) {
      payload.reply_markup = { inline_keyboard: buttons };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return await res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    console.error("sendTelegramMessage error:", err);
    return { ok: false, error: message };
  }
}

export async function sendProDecision(
  telegramId: string,
  status: "approved" | "rejected",
  extra?: { date?: string; reason?: string; lang?: string },
) {
  const l = resolveLang(extra?.lang);
  const c = botCopy[l];
  if (status === "approved") {
    const date = extra?.date ?? "";
    return await sendTelegramMessage(
      telegramId,
      date ? fill(c.proApproved, { date }) : fill(c.proApproved, { date: "—" }),
    );
  }
  const reason = extra?.reason ? `: ${esc(extra.reason)}` : "";
  return await sendTelegramMessage(telegramId, fill(c.proDenied, { reason }));
}
