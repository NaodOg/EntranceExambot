import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { sendProDecision } from "@/lib/bot";
import { formatDate } from "@/lib/bot/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF / cross-origin hardening: only accept same-origin browser calls.
  const origin = request.headers.get("origin");
  if (origin) {
    const originHost = (() => {
      try {
        return new URL(origin).host;
      } catch {
        return null;
      }
    })();
    const expectedHost = new URL(request.url).host;
    if (originHost && originHost !== expectedHost) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = (await request.json()) as {
    telegramId?: string;
    status?: "approved" | "rejected";
    reason?: string;
  };

  if (!body.telegramId || !/^\d+$/.test(body.telegramId)) {
    return NextResponse.json({ error: "Invalid telegramId" }, { status: 400 });
  }
  if (body.status !== "approved" && body.status !== "rejected") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  let date: string | undefined;
  if (body.status === "approved" && convexUrl) {
    const settings = await new ConvexHttpClient(convexUrl).query(api.settings.get, {});
    if (settings?.examSeasonEndAt) {
      date = formatDate(settings.examSeasonEndAt, "en");
    }
  }

  const reason = body.reason?.slice(0, 300);
  const result = await sendProDecision(body.telegramId, body.status, {
    date,
    reason,
  });

  return NextResponse.json({ ok: true, result });
}
