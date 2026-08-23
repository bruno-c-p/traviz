import { betterAuth } from "better-auth";
import { dialect } from "@/lib/server/db";

export const auth = betterAuth({
  database: { dialect, type: "sqlite" },
  emailAndPassword: {
    enabled: true,
  },
  baseURL: {
    allowedHosts: ["localhost:3000", "*.vercel.app", "traviz.brunocardozo.com.br"],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
  },
});
