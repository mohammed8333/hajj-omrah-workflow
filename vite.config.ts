import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./", // Makes all assets relative, ideal for GitHub Pages on any repository name
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/link": path.resolve(__dirname, "./src/lib/next-compat/link.tsx"),
      "next/navigation": path.resolve(__dirname, "./src/lib/next-compat/navigation.ts"),
    },
  },
  build: {
    outDir: "docs", // Ready for GitHub Pages branch /docs deployment
    emptyOutDir: true,
  },
});
