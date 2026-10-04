import { ConvexHttpClient } from "convex/browser";
import { createHmac } from "crypto";
import { api } from "convex/_generated/api";
import type { Lang } from "./copy";

let client: ConvexHttpClient | null = null;

export function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }
  client ??= new ConvexHttpClient(url);
  return client;
}

/**
 * Produces the server-side proof Convex requires for bot calls. The bot webhook
 * is authenticated by the Telegram secret token, so it may act on behalf of a
 * user by proving possession of the bot token via HMAC.
 */
export function botProofFor(telegramId: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return createHmac("sha256", token).update(`bot:${telegramId}`).digest("hex");
}

function withProof<T>(args: T): T {
  if (args && typeof args === "object" && "telegramId" in (args as Record<string, unknown>)) {
    const telegramId = String((args as Record<string, unknown>).telegramId);
    return { ...(args as Record<string, unknown>), botProof: botProofFor(telegramId) } as T;
  }
  return args;
}

type Convex = ReturnType<typeof getConvex>;

/** A Convex client that transparently attaches a bot proof for user calls. */
export type AuthedConvex = {
  query: Convex["query"];
  mutation: Convex["mutation"];
};

function authedConvex(base: Convex): AuthedConvex {
  return {
    query: ((ref: Parameters<Convex["query"]>[0], args?: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (base.query as any)(ref, withProof(args))) as Convex["query"],
    mutation: ((ref: Parameters<Convex["mutation"]>[0], args?: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (base.mutation as any)(ref, withProof(args))) as Convex["mutation"],
  };
}

export async function ensureProfile(from: {
  id: number;
  username?: string;
  first_name?: string;
}) {
  const telegramId = String(from.id);
  const convex = authedConvex(getConvex());
  const profile = await convex.mutation(api.users.getOrCreateFromTelegram, {
    telegramId,
    username: from.username,
    firstName: from.first_name,
  });
  return {
    convex,
    telegramId,
    profile,
    lang: (profile.language === "am" ? "am" : "en") as Lang,
  };
}

export type Ensured = Awaited<ReturnType<typeof ensureProfile>>;
