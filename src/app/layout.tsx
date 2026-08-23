import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "../components/AppShell";
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
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-canvas-soft font-sans text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
