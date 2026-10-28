import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyAuthCookieValue } from "./src/lib/auth";

function isPublicPath(pathname) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth/login")) return true;
  if (pathname.startsWith("/api/auth/session")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function safeNextPath(pathname, search) {
  return `${pathname}${search || ""}`;
}

export async function proxy(req) {
  const { pathname, search } = req.nextUrl;
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const isAuthed = cookie ? await verifyAuthCookieValue(cookie) : false;

  if (isPublicPath(pathname)) {
    // Login restores the Firebase session before navigating; a cookie alone
    // must not bounce a signed-out Firebase user back into the workspace.
    return NextResponse.next();
  }

  if (isAuthed) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", safeNextPath(pathname, search));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/((?!api/auth/login|api/auth/session|_next/static|_next/image|favicon.ico).*)"],
};
