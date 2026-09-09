import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { existsSync, rmSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
    {
      // README из public/ads — инструкция для разработки, в APK не нужна
      name: "drop-ads-readme",
      closeBundle() {
        const f = "dist/ads/README.md";
        if (existsSync(f)) rmSync(f);
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: "wss" },
  },
  preview: { host: "0.0.0.0", port: 4173, allowedHosts: true },
});
