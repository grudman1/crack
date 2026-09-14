/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
    // The RLS suite needs Docker + a running local Supabase stack, so it
    // stays out of the default run. `npm run test:rls` uses
    // vitest.rls.config.ts instead.
    exclude: [...configDefaults.exclude, 'tests/rls/**'],
  },
});
