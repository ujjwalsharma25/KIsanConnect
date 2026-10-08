import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// React dev server on :5173, proxies API + uploaded photos to the Express backend on :5000
// so the browser only ever talks to one origin during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
    },
  },
  build: {
    outDir: "dist",
  },
});
