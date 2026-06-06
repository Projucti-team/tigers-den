import type { NextResponse } from "next/server";

/** Match collections/Users.ts cookie secure flag. */
export function payloadCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** Expire Payload auth cookie on a redirect/JSON response. */
export function clearPayloadAuthCookie(response: NextResponse): void {
  response.cookies.set("payload-token", "", {
    expires: new Date(0),
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: payloadCookieSecure(),
  });
}
