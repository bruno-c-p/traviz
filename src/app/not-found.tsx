import type { Metadata } from "next";
import { NotOnTheMap } from "@/features/landing/server";

export const metadata: Metadata = {
  title: "Not on the map · Traviz",
};

export default function NotFound() {
  return <NotOnTheMap />;
}
