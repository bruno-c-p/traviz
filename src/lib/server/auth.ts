import { betterAuth } from "better-auth";
import { dialect } from "./db.ts";

export const auth = betterAuth({
  database: { dialect, type: "sqlite" },
  emailAndPassword: {
    enabled: true,
  },
  baseURL: {
    allowedHosts: ["localhost:3000", "*.vercel.app"],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
  },
});
