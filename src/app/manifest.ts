import type { MetadataRoute } from "next";
import { homePath } from "@/paths";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "traviz",
    short_name: "traviz",
    description: "Mark the countries you've visited and want to visit on an interactive globe.",
    start_url: homePath(),
    scope: homePath(),
    display: "standalone",
    background_color: "#e8ebe6",
    theme_color: "#e8ebe6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
