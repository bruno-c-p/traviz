import type { NextConfig } from "next";
import { welcomePath } from "@/paths";

const LANDING_ASSETS = `${welcomePath()}/_astro/:asset*`;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  rewrites: async () => [{ source: welcomePath(), destination: `${welcomePath()}/index.html` }],
  headers: async () => [
    {
      source: LANDING_ASSETS,
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ],
};

export default nextConfig;
