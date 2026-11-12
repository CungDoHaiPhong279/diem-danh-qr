import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Integration tests read SUPABASE_* from .env.test.local locally, from process env in CI.
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // server-only throws outside a react-server environment
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: { env: loadEnv(mode, process.cwd(), "SUPABASE_"), fileParallelism: false },
}));
