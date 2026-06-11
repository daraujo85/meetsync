import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      // Página de boas-vindas: não é referenciada no manifest (aberta via runtime.getURL),
      // então precisa ser declarada como entrada extra para o crxjs/Rollup empacotá-la.
      input: {
        welcome: resolve(__dirname, 'src/welcome/welcome.html'),
      },
    },
  },
  // O dev-server do crxjs usa websocket para HMR do content script.
  server: {
    cors: { origin: [/chrome-extension:\/\//] },
  },
});
