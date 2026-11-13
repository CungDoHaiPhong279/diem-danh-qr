import { expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  admin: { from: () => ({ select: () => ({ limit: async () => ({ error: { message: "secret detail" } }) }) }) },
}));

it("GET /api/health returns 503 {ok:false} without details when the query fails", async () => {
  const { GET } = await import("@/app/api/health/route");
  const res = await GET();
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ ok: false });
});
