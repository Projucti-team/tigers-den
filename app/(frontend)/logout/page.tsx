import { redirect } from "next/navigation";

/** Browser-friendly alias → server logout handler. */
export default function LogoutPage() {
  redirect("/api/admin/logout");
}
