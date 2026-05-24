import type { Metadata } from "next";
import type { ReactNode } from "react";

/* Tailwind lives in app/(frontend)/layout.tsx only — do not import globals here or Payload admin breaks */

export const metadata: Metadata = {
  title: "The Tigers' Den — Bangladesh Cricket Fan Army",
  description:
    "The definitive community hub for passionate Bangladesh cricket fans. Live scores, forum, chants, and tour travel.",
  icons: {
    icon: [{ url: "/tigers-den-logo-nav.png", type: "image/png" }],
    apple: [{ url: "/tigers-den-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
