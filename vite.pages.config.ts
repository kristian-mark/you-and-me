import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(process.cwd(), "spa"),
  base: "/you-and-me/",
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
    },
  },
  publicDir: resolve(process.cwd(), "spa/public"),
  build: {
    outDir: resolve(process.cwd(), "docs"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        assetFileNames: "assets/app[extname]",
      },
    },
  },
});
