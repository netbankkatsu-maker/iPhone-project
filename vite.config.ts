import { defineConfig } from "vite";

export default defineConfig({
  base: "/iPhone-project/",
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
