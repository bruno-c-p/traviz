import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { cn } from "@/shared/cn";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument-sans",
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  preload: false,
});

export const metadata: Metadata = {
  title: "traviz",
  applicationName: "traviz",
  appleWebApp: {
    capable: true,
    title: "traviz",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f6f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(instrumentSans.variable, geistMono.variable)}>
      <body className="bg-canvas-soft font-sans text-ink">{children}</body>
    </html>
  );
}
