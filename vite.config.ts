import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { join } from "path";

export default defineConfig({
  plugins: [vue()],
  base: "./",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": join(__dirname, "src/renderer"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
