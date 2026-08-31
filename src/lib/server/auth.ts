import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { dialect } from "@/lib/server/db";
import { sendMagicLinkEmail } from "@/lib/server/email";

export const auth = betterAuth({
  database: { dialect, type: "sqlite" },
  baseURL: {
    allowedHosts: ["localhost:3000", "*.vercel.app", "traviz.brunocardozo.com.br"],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
  ],
});
