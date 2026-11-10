import { type Plugin, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const workerUrl = "http://127.0.0.1:8787";

/**
 * The CSS names the fonts, so without this the browser only starts fetching them after
 * the CSS arrives, draws text in a fallback font, then swaps (a visible jump). Preloading
 * the two Latin files lets them download alongside the JS and CSS.
 */
function preloadLatinFonts(): Plugin {
  return {
    name: "playden:preload-latin-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        return Object.keys(ctx.bundle ?? {})
          .filter((file) => /-latin-wght-normal-[\w-]+\.woff2$/.test(file))
          .map((file) => ({
            tag: "link",
            attrs: {
              rel: "preload",
              href: `/${file}`,
              as: "font",
              type: "font/woff2",
              crossorigin: "",
            },
            injectTo: "head" as const,
          }));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadLatinFonts()],
  server: {
    host: true,
    proxy: {
      "/api": { target: workerUrl, ws: true },
      "/auth": { target: workerUrl },
    },
  },
});
