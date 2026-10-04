/**
 * Server-side authorization helpers for Convex functions.
 *
 * Convex functions are publicly callable, so privileged operations must prove
 * the caller holds a signed token minted by the Next.js admin session. User
 * operations prove possession of Telegram WebApp initData (HMAC-signed by the
 * bot token) or a server-side bot proof.
 *
 * Uses the Web Crypto API available in the Convex default runtime.
 */

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(new Uint8Array(signature));
}

function base64UrlDecodeToString(value: string): string {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Candidate keys for verifying admin session tokens. The first is derived from
 * the bot token (matches Next.js with no extra config); the rest preserve
 * compatibility with explicitly configured secrets if present.
 */
async function adminCandidateKeys(): Promise<string[]> {
  const keys: string[] = [];
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) keys.push(await hmacHex(token, "exam-bot:admin-session"));
  if (process.env.ADMIN_SESSION_SECRET) keys.push(process.env.ADMIN_SESSION_SECRET);
  if (process.env.ADMIN_PASSWORD) keys.push(process.env.ADMIN_PASSWORD);
  return keys;
}

/** Verify a signed, expiring admin token and return the admin email. */
export async function requireAdmin(token: string | undefined | null): Promise<string> {
  const candidates = await adminCandidateKeys();
  if (!candidates.length) throw new Error("Admin auth is not configured");
  if (!token) throw new Error("Unauthorized");

  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Unauthorized");

  let valid = false;
  for (const key of candidates) {
    const expected = await hmacHex(key, payload);
    if (safeEqual(expected, signature)) {
      valid = true;
      break;
    }
  }
  if (!valid) throw new Error("Unauthorized");

  let decoded: { email?: string; exp?: number };
  try {
    decoded = JSON.parse(base64UrlDecodeToString(payload)) as {
      email?: string;
      exp?: number;
    };
  } catch {
    throw new Error("Unauthorized");
  }

  if (!decoded.exp || decoded.exp <= Date.now()) throw new Error("Session expired");
  return decoded.email ?? "admin@local.dev";
}

type InitDataUser = { id: number };

/** Validate Telegram WebApp initData (HMAC-SHA256 signed by the bot token). */
export async function validateInitData(initData: string): Promise<string> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Server not configured");
  if (!initData) throw new Error("Unauthorized");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Unauthorized");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // secret_key = HMAC_SHA256(key = "WebAppData", message = bot_token)
  // hash = HMAC_SHA256(key = secret_key, message = data_check_string)
  const secretKeyHex = await hmacHex("WebAppData", botToken);
  const secretKeyBytes = new Uint8Array(
    (secretKeyHex.match(/.{2}/g) ?? []).map((byte) => Number.parseInt(byte, 16)),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(dataCheckString));
  const calculated = toHex(new Uint8Array(signature));
  if (!safeEqual(calculated, hash)) throw new Error("Unauthorized");

  const authDate = Number(params.get("auth_date") ?? "0");
  const maxAgeSeconds = 60 * 60 * 24;
  if (Date.now() / 1000 - authDate > maxAgeSeconds) throw new Error("Init data expired");

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Unauthorized");
  const user = JSON.parse(userRaw) as InitDataUser;
  if (typeof user.id !== "number") throw new Error("Unauthorized");
  return String(user.id);
}

/** Proof that the caller is the trusted bot acting for a given telegram id. */
export async function validateBotProof(
  telegramId: string,
  proof: string | undefined | null,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Server not configured");
  if (!proof) throw new Error("Unauthorized");
  const expected = await hmacHex(botToken, `bot:${telegramId}`);
  if (!safeEqual(expected, proof)) throw new Error("Unauthorized");
}

/** Compute the bot proof for a telegram id (server-side helpers only). */
export async function botProofFor(telegramId: string): Promise<string> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Server not configured");
  return await hmacHex(botToken, `bot:${telegramId}`);
}

/**
 * Resolve the acting telegram id. Accepts a validated initData (Mini App) or a
 * bot proof + telegramId (trusted bot). Throws if neither is valid.
 */
export async function resolveTelegramId(args: {
  telegramId?: string;
  initData?: string;
  botProof?: string;
}): Promise<string> {
  if (args.initData) {
    return await validateInitData(args.initData);
  }
  if (args.telegramId && args.botProof) {
    await validateBotProof(args.telegramId, args.botProof);
    return args.telegramId;
  }
  throw new Error("Unauthorized");
}
