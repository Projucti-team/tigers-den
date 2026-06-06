import { logout } from "@payloadcms/next/auth";
import { NextResponse } from "next/server";

import { clearPayloadAuthCookie } from "@/lib/payload-logout";
import config from "@payload-config";

export const dynamic = "force-dynamic";

/** Server-side Payload logout — clears the HTTP-only session cookie. */
export async function GET(request: Request) {
  try {
    await logout({ config, allSessions: true });
  } catch {
    // Still clear the browser cookie even if session lookup fails (CSRF / proxy quirks).
  }

  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  clearPayloadAuthCookie(response);
  return response;
}
