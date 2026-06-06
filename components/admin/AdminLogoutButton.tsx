"use client";

import { Button } from "@payloadcms/ui";

async function logoutAdmin() {
  await fetch("/api/users/logout?allSessions=true", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  window.location.href = "/admin/login";
}

/** Sidebar + header logout for Payload admin. */
export default function AdminLogoutButton() {
  return (
    <Button
      buttonStyle="secondary"
      className="admin-logout-button"
      onClick={() => void logoutAdmin()}
    >
      Log out
    </Button>
  );
}
