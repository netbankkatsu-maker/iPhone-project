import { defineConfig } from "vite";

export default defineConfig({
  base: "/iphone-project/",
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
