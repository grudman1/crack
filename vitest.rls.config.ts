/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';

// RLS suite: runs against a local Supabase stack (`supabase start`), not
// jsdom, and is kept out of the default `npm test` run because it needs
// Docker. See tests/rls/rls.test.ts.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Policies are evaluated against shared room/profile state; running
    // files in parallel would make the enumeration assertions flaky.
    fileParallelism: false,
  },
});
