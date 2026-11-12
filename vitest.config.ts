import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Integration tests read SUPABASE_* from .env.test.local locally, from process env in CI.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "SUPABASE_");
  // lib/supabase/admin.ts reads the NEXT_PUBLIC_ name
  return {
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // server-only throws outside a react-server environment
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: { env: { ...env, NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_URL }, fileParallelism: false },
  };
});
