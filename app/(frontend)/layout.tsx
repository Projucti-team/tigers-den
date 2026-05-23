import { Inter, Montserrat, Roboto_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "@/app/globals.css";

import { FanMarquee } from "@/components/layout/FanMarquee";
import { Navbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TopBar } from "@/components/layout/TopBar";

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

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${montserrat.variable} ${inter.variable} ${robotoMono.variable} fan-page-bg min-h-screen`}
    >
      <TopBar />
      <Navbar />
      <FanMarquee />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
