import { defineConfig } from "vite";

export default defineConfig(async () => ({
  clearScreen: false,
  build: {
    outDir: "dist",
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
