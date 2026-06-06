"use client";

import { Button } from "@payloadcms/ui";

/** Full navigation so logout runs on the server (/logout), not a client fetch. */
export default function AdminLogoutButton() {
  return (
    <Button
      buttonStyle="secondary"
      className="admin-logout-button"
      onClick={() => {
        window.location.href = "/api/admin/logout";
      }}
    >
      Log out
    </Button>
  );
}
