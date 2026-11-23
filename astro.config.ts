import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "./landing",
  publicDir: "./landing/public",
  outDir: "./public/welcome",
  base: "/welcome",
  devToolbar: { enabled: false },
  vite: { plugins: [tailwindcss()] },
});
