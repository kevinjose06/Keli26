import { defineConfig } from "vite";
import react            from "@vitejs/plugin-react";
import tailwindcss      from "@tailwindcss/vite";
import * as fs          from "node:fs";
import * as path        from "path";

const keyPath = path.resolve(__dirname, "../keli-backend/server.key");
const certPath = path.resolve(__dirname, "../keli-backend/server.cert");

const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    ...(hasCerts ? {
      https: {
        key:  fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    } : {}),
    proxy: {
      "/api": {
        target:       hasCerts ? "https://127.0.0.1:3000" : "http://127.0.0.1:3000",
        secure:       false,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir:     "../keli-backend/app",
    emptyOutDir: true,
    minify:     true,
  },
});
