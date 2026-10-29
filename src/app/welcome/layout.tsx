import { Instrument_Sans } from "next/font/google";

const landingSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <div className={landingSans.className}>{children}</div>;
}
