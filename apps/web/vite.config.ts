import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@poke-organizer/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-joyride') || id.includes('lucide-react')) {
              return 'vendor';
            }
          }
        }
      }
    }
  },
  server: {
    allowedHosts: true,
    host: "0.0.0.0",
    port: 5173
  }
});
