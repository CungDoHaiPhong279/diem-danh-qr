import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Integration tests read SUPABASE_* from .env.test.local locally, from process env in CI.
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { env: loadEnv(mode, process.cwd(), "SUPABASE_"), fileParallelism: false },
}));
