"use client";

import { useEffect } from "react";

/** Visit /logout to end the Payload admin session (e.g. when the sidebar button is hard to find). */
export default function LogoutPage() {
  useEffect(() => {
    fetch("/api/users/logout?allSessions=true", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).finally(() => {
      window.location.replace("/admin/login");
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-lg uppercase tracking-wide text-pitch">Logging out…</p>
      <p className="mt-2 text-sm text-charcoal/70">Redirecting to admin login.</p>
    </main>
  );
}
