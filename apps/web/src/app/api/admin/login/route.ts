import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_TOKEN_COOKIE,
  checkAdminPassword,
  createAdminSession,
  getAdminEmail,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = createAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin auth is not configured" }, { status: 503 });
  }

  const response = NextResponse.json({
    ok: true,
    email: getAdminEmail(),
    token: session,
  });

  response.cookies.set(ADMIN_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  // Readable copy used by the admin client to sign Convex calls.
  response.cookies.set(ADMIN_TOKEN_COOKIE, session, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  response.cookies.delete(ADMIN_TOKEN_COOKIE);
  return response;
}
