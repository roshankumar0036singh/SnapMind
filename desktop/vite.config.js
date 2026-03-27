import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  base: './', // CRITICAL: Use relative paths for Electron
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  optimizeDeps: {
    include: ['react-window']
  }
});
