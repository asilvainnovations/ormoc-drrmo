import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Integration tests: real supabase-js -> PostgREST -> PostgreSQL with RLS. Run with scripts/it_test.sh.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['tests/integration/**/*.it.test.ts'], setupFiles: ['src/test/setup.ts'], testTimeout: 30_000, fileParallelism: false },
});
