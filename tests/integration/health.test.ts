import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

// connection() only works inside a Next request scope; stub it for a direct handler call.
vi.mock("next/server", () => ({ connection: async () => {} }));

describe("GET /api/health", () => {
  it("200 {ok:true} with no-store against local Supabase", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
