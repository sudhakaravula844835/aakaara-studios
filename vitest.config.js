import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.spec.js', '**/.claude/**'],
    setupFiles: ['./board/test/vitest.setup.js'],
  },
  resolve: {
    alias: {
      // invite-staff.ts (a Deno/Netlify Edge Function) imports supabase-js by
      // URL -- the only way Deno resolves bare ESM imports. Under Vitest/Node,
      // alias that exact specifier to the already-installed npm package so
      // board/test/invite-staff-function.test.js can import the edge
      // function module directly, instead of needing a Deno/netlify-dev
      // process just to exercise its logic.
      'https://esm.sh/@supabase/supabase-js@2': '@supabase/supabase-js',
    },
  },
});
