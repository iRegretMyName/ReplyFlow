import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    // Forward /api calls (and uploaded images) to the Express server so the browser never hits CORS in dev.
    proxy: { '/api': 'http://localhost:3001', '/uploads': 'http://localhost:3001' },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
