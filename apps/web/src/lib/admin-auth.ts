import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "exam_bot_admin_session";
export const ADMIN_TOKEN_COOKIE = "exam_bot_admin_api";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sessionSecret(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  // Must match convex/lib/auth.ts adminSigningKey().
  return createHmac("sha256", token).update("exam-bot:admin-session").digest("hex");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Create a signed, expiring admin session token (verified by Convex). */
export function createAdminSession(): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = base64UrlEncode(
    JSON.stringify({ email: getAdminEmail(), exp: Date.now() + SESSION_TTL_MS }),
  );
  return `${payload}.${signPayload(payload, secret)}`;
}

function verifyAdminSession(token: string): boolean {
  const secret = sessionSecret();
  if (!secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = signPayload(payload, secret);
  if (expected.length !== sig.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  } catch {
    return false;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { exp?: number };
    return typeof decoded.exp === "number" && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

/** Constant-time password comparison against the configured admin password. */
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function isAdminAuthenticated() {
  const session = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!session) return false;
  return verifyAdminSession(session);
}

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL ?? "admin@local.dev";
}
