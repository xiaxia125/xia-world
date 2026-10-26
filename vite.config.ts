import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base keeps the build portable on Vercel, Cloudflare Pages
// and GitHub Pages project sites alike.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
  },
});
