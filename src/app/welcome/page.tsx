import type { Metadata } from "next";
import { LandingPage } from "@/features/landing";

const title = "Traviz: keep count of the countries you’ve seen";

const description =
  "Mark every country you’ve visited, want to visit or would skip, on a globe, in a list and in your totals. Sign in with an email link, no password.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", siteName: "Traviz" },
  twitter: { card: "summary", title, description },
};

export default function WelcomePage() {
  return <LandingPage />;
}
