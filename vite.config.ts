import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

function autoVersionPlugin() {
  const buildTimestamp = Date.now();
  return {
    name: "auto-version-plugin",
    config() {
      return {
        define: {
          __APP_BUILD_TIME__: JSON.stringify(buildTimestamp),
        },
      };
    },
    buildStart() {
      const publicDir = path.resolve(__dirname, "./public");
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(publicDir, "version.json"),
        JSON.stringify({
          version: buildTimestamp,
          builtAt: new Date(buildTimestamp).toISOString(),
        })
      );
    },
    transformIndexHtml(html: string) {
      return html.replace(/%APP_BUILD_TIME%/g, String(buildTimestamp));
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({
          version: buildTimestamp,
          builtAt: new Date(buildTimestamp).toISOString(),
        }),
      });
    },
    closeBundle() {
      const outDir = path.resolve(__dirname, "./docs");
      const indexPath = path.join(outDir, "index.html");
      const notFoundPath = path.join(outDir, "404.html");
      if (fs.existsSync(indexPath)) {
        try {
          fs.copyFileSync(indexPath, notFoundPath);
          console.log("[auto-version-plugin] Synchronized 404.html with index.html");
        } catch (e) {
          console.error("Failed to copy 404.html:", e);
        }
      }

      // Preserve backwards compatibility for cached browsers
      const assetsDir = path.join(outDir, "assets");
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const currentJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
        const currentCss = files.find((f) => f.startsWith("index-") && f.endsWith(".css"));

        const legacyJsFiles = [
          "index-B-T5ib8S.js",
          "index-yNnBZM0a.js",
          "index-BhcvEjM6.js",
          "index-Bm8nOx5y.js",
          "index-BebDt11y.js",
          "index-bqTvIEOr.js",
        ];
        const legacyCssFiles = [
          "index-DPOJEpv3.css",
          "index-B1zo2y_x.css",
          "index-DbVaPr8P.css",
          "index-CscPjje2.css",
          "index-B4wyjQBa.css",
        ];

        if (currentJs) {
          legacyJsFiles.forEach((legacyName) => {
            if (legacyName !== currentJs) {
              try {
                fs.copyFileSync(path.join(assetsDir, currentJs), path.join(assetsDir, legacyName));
              } catch (_) {}
            }
          });
        }
        if (currentCss) {
          legacyCssFiles.forEach((legacyName) => {
            if (legacyName !== currentCss) {
              try {
                fs.copyFileSync(path.join(assetsDir, currentCss), path.join(assetsDir, legacyName));
              } catch (_) {}
            }
          });
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [autoVersionPlugin(), react(), tailwindcss()],
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
