import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { loadEnv } from "vite";

const env = { ...loadEnv("test", process.cwd(), "SUPABASE_"), ...process.env };

/** Tests create users and write data: refuse anything but a local Supabase. */
export function assertLocalSupabase(url: string | undefined): asserts url is string {
  if (!["localhost", "127.0.0.1"].includes(URL.canParse(url ?? "") ? new URL(url!).hostname : "")) throw new Error("e2e writes data: refusing non-local SUPABASE_URL");
}

/** Password sign-in against the local Supabase; puts the session cookies the app expects into the browser. */
export async function signInAs(context: BrowserContext, email: string, password: string): Promise<void> {
  const url = env.SUPABASE_URL;
  assertLocalSupabase(url);
  const jar = new Map<string, string>();
  const supabase = createServerClient(url, env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (jar.size === 0) throw new Error("signInAs: no session cookies were set");
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
}
