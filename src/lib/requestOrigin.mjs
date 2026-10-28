// Next can use the bind address (0.0.0.0) in req.url during local development.
// The Host header identifies the address the browser actually requested.
export function hasSameRequestOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const requestUrl = new URL(req.url);
    const host = req.headers.get("host") || requestUrl.host;
    const expected = new URL(`${requestUrl.protocol}//${host}`).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}
