import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "zustand"],
          canvas: ["reactflow"],
          icons: ["lucide-react"]
        }
      }
    }
  },
  server: {
    proxy: {
      "/api": "http://localhost:3030",
      "/media": "http://localhost:3030"
    }
  }
});
