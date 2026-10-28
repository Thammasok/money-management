import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const DEFAULT_PORT = 5173;
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';

// Two knobs, both read from the environment so that Playwright (playwright.config.ts) can decide which API the
// Web App talks to without the specs knowing:
//   PORT              the dev server port (default 5173; run-eval.sh exports its own).
//   API_PROXY_TARGET  where `/api` is proxied: the NestJS backend (default :3000, integration mode) or the
//                     Mountebank impostor of it (:4545, mock mode). The browser only ever calls `/api` on its own
//                     origin, so the httpOnly session cookie stays same-origin in both modes.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || DEFAULT_PORT,
    // Fail loudly instead of drifting to another port: a Playwright run must never test someone else's server.
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET,
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
