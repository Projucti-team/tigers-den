import type { Metadata } from "next";
import type { ReactNode } from "react";

/* Tailwind lives in app/(frontend)/layout.tsx only — do not import globals here or Payload admin breaks */

export const metadata: Metadata = {
  title: "The Tigers' Den — Bangladesh Cricket Fan Army",
  description:
    "The definitive community hub for passionate Bangladesh cricket fans. Live scores, forum, chants, and tour travel.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
