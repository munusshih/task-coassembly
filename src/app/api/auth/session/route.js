import { NextResponse } from "next/server";
import { COOKIE_NAME, getUsernameFromAuthCookieValue } from "../../../../lib/auth";

export async function GET(req) {
  const rawCookie = req.cookies.get(COOKIE_NAME)?.value;
  const username = rawCookie ? await getUsernameFromAuthCookieValue(rawCookie) : null;

  if (!username) {
    return NextResponse.json({ authenticated: false, username: null }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, username });
}
