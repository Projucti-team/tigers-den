import { Inter, Montserrat, Roboto_Mono } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";

export const dynamic = "force-dynamic";

const SITE_TITLE = "The Tigers' Den — Bangladesh Cricket Fan Army";
const SITE_DESCRIPTION =
  "The definitive community hub for passionate Bangladesh cricket fans. Live scores, forum, chants, and tour travel.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tigersden.bd"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [{ url: "/tigers-den-logo-nav.png", type: "image/png" }],
    apple: [{ url: "/tigers-den-logo.png", type: "image/png" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://tigersden.bd",
    siteName: "The Tigers' Den",
    images: [{ url: "/tigers-den-logo.png", width: 479, height: 512, alt: "The Tigers' Den logo" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/tigers-den-logo.png"],
  },
};

import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { LiveMarquee } from "@/components/cricket/LiveMarquee";
import { Navbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TopBar } from "@/components/layout/TopBar";
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import { FeedbackButton } from "@/components/FeedbackButton";
import { ensureCricketSnapshotsFresh } from "@/lib/cricket/services/ensure-cricket-fresh";
import { getMarqueeTickerSnapshot } from "@/lib/cricket/services/marquee-ticker";
import { getTourNavLinks } from "@/lib/cricket/services/tours-display";

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

  const [marqueeSnapshot, tourLinks] = await Promise.all([
    getMarqueeTickerSnapshot().catch((e) => {
      console.error("[cricket] getMarqueeTickerSnapshot failed, falling back to brand-only marquee:", e);
      return {
        items: ["🐅 THE TIGERS' DEN", "🇧🇩 GREEN & RED ARMY", "🔥 ROAR FOR BANGLADESH"],
        isLive: false,
      };
    }),
    getTourNavLinks(),
  ]);

  return (
    <html lang="en">
      <body>
        <GoogleAnalytics />
        <AuthSessionProvider>
          <div
            className={`${montserrat.variable} ${inter.variable} ${robotoMono.variable} fan-page-bg min-h-screen text-white`}
          >
            <TopBar />
            <Navbar tourLinks={tourLinks} initialIsLive={marqueeSnapshot.isLive} />
            <LiveMarquee initialItems={marqueeSnapshot.items} />
            <main>{children}</main>
            <SiteFooter />
            <FeedbackButton />
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
