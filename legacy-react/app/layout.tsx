import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { ThemeScript } from "@/features/theme";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f110d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(instrumentSans.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="bg-canvas-soft font-sans text-ink">{children}</body>
    </html>
  );
}
