import { NextResponse } from "next/server";
import { COOKIE_NAME, createFirebaseAuthCookieValue, getAuthCookieOptions, getUsernameFromAuthCookieValue } from "../../../../lib/auth";
import { verifyFirebaseMemberToken } from "../../../../lib/firebaseSession.mjs";
import { hasSameRequestOrigin } from "../../../../lib/requestOrigin.mjs";

export async function POST(req) {
  if (!hasSameRequestOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 }); }
  try {
    const identity = await verifyFirebaseMemberToken(body?.idToken, {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    if (!identity) return NextResponse.json({ error: "Sign in with an active member account." }, { status: 401 });
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(COOKIE_NAME, await createFirebaseAuthCookieValue(identity.uid), getAuthCookieOptions());
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Could not verify sign-in. Please try again." }, { status: 503 });
  }
}

export async function GET(req) {
  const rawCookie = req.cookies.get(COOKIE_NAME)?.value;
  const username = rawCookie ? await getUsernameFromAuthCookieValue(rawCookie) : null;

  if (!username) {
    return NextResponse.json({ authenticated: false, username: null }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, username });
}
