import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { preconnect } from "react-dom";
import { AppShell } from "@/components/AppShell";
import { SessionLayer } from "@/components/SessionLayer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "traviz",
};

export const viewport: Viewport = {
  themeColor: "#e8ebe6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  preconnect("https://api.mapbox.com", { crossOrigin: "anonymous" });

  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-canvas-soft font-sans text-ink">
        <ClerkProvider>
          <AppShell>{children}</AppShell>
          <Suspense fallback={null}>
            <SessionLayer />
          </Suspense>
        </ClerkProvider>
      </body>
    </html>
  );
}
