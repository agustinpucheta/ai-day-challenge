import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// The browser only talks to the Vite origin (http://localhost:5173); /api is proxied to the
// NestJS API. `changeOrigin` stays off: it only rewrites Host, and the browser's Origin header
// is forwarded untouched, which is what the backend CSRF Origin check validates.
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: API_TARGET },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    restoreMocks: true,
  },
});
