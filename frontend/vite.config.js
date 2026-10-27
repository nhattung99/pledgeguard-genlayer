import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/react-dom|\/react\/|scheduler/.test(id)) return "react";
          if (/genlayer-js/.test(id)) return "genlayer";
          if (/viem|ox\/|@noble|@scure/.test(id)) return "evm";
          return "vendor";
        },
      },
    },
  },
});
