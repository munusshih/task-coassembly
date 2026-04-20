import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createAuthCookieValue,
  getAuthCookieOptions,
  validatePassword,
} from "../../../../lib/auth";

function sanitizeNextPath(nextParam) {
  if (!nextParam || typeof nextParam !== "string") return "/";
  if (!nextParam.startsWith("/")) return "/";
  if (nextParam.startsWith("//")) return "/";
  return nextParam;
}

export async function POST(req) {
  const formData = await req.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const nextParam = String(formData.get("next") || "/");
  const safeNext = sanitizeNextPath(nextParam);

  if (!(await validatePassword(password))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "1");
    if (safeNext && safeNext !== "/") {
      url.searchParams.set("next", safeNext);
    }
    return NextResponse.redirect(url, { status: 303 });
  }

  const cookieValue = await createAuthCookieValue(username);
  const url = new URL(safeNext, req.url);
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set(COOKIE_NAME, cookieValue, getAuthCookieOptions());
  return res;
}
