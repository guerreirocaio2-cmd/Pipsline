import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Pipsfit — treino e evolução",
        short_name: "Pipsfit",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f4f5ef",
        theme_color: "#102b26",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
});
