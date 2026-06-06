import { Inter, Montserrat, Roboto_Mono } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "The Tigers' Den — Bangladesh Cricket Fan Army",
  description:
    "The definitive community hub for passionate Bangladesh cricket fans. Live scores, forum, chants, and tour travel.",
  icons: {
    icon: [{ url: "/tigers-den-logo-nav.png", type: "image/png" }],
    apple: [{ url: "/tigers-den-logo.png", type: "image/png" }],
  },
};

import { FanMarquee } from "@/components/layout/FanMarquee";
import { Navbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TopBar } from "@/components/layout/TopBar";
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import { ensureCricketSnapshotsFresh } from "@/lib/cricket/services/ensure-cricket-fresh";
import { getMarqueeTickerItems } from "@/lib/cricket/services/marquee-ticker";
import { getToursIndexSnapshot } from "@/lib/cricket/services/tours";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["700", "800", "900"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  weight: ["500", "700"],
});

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  await ensureCricketSnapshotsFresh();

  const [marqueeItems, toursSnapshot] = await Promise.all([
    getMarqueeTickerItems().catch(() => [
      "🐅 THE TIGERS' DEN",
      "🇧🇩 GREEN & RED ARMY",
      "🔥 ROAR FOR BANGLADESH",
    ]),
    getToursIndexSnapshot(),
  ]);

  const tourLinks = toursSnapshot?.navLinks ?? [];

  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>
          <div
            className={`${montserrat.variable} ${inter.variable} ${robotoMono.variable} fan-page-bg min-h-screen text-white`}
          >
            <TopBar />
            <Navbar tourLinks={tourLinks} />
            <FanMarquee items={marqueeItems} />
            <main>{children}</main>
            <SiteFooter />
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
