import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cartographer } from '@replit/vite-plugin-cartographer';
import { runtimeErrorModal } from '@replit/vite-plugin-runtime-error-modal';
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    cartographer(),
    runtimeErrorModal(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  root: ".",
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
    rollupOptions: {
      input: "./index.html",
    },
  },
});
