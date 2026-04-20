import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyAuthCookieValue } from "./lib/auth";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow login page and auth API routes through without a session
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const rawCookie = req.cookies.get(COOKIE_NAME)?.value;
  const valid = rawCookie ? await verifyAuthCookieValue(rawCookie) : false;

  if (!valid) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
