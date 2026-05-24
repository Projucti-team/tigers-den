import type { ReactNode } from "react";

/**
 * Root layout must not render <html>/<body> — Payload's admin layout provides its own.
 * The public site uses <html>/<body> in app/(frontend)/layout.tsx.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
