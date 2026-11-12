import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "@/lib/turnstile";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("verifyTurnstile", () => {
  it("returns false without calling fetch when token is null", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await verifyTurnstile(null, "1.2.3.4")).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("fails closed without secret", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await verifyTurnstile("tok", null)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("true only on success===true, false on network error", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ success: true }));
    expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
    expect(String(spy.mock.calls[0][1]?.body)).toContain("remoteip=1.2.3.4");
    spy.mockResolvedValueOnce(Response.json({ success: false }));
    expect(await verifyTurnstile("tok", null)).toBe(false);
    spy.mockRejectedValueOnce(new Error("net"));
    expect(await verifyTurnstile("tok", null)).toBe(false);
  });
});
