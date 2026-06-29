import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: "http://localhost:4001",
        changeOrigin: true
      }
    }
  }
});