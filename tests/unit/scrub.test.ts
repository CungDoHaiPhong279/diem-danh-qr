import { describe, expect, it } from "vitest";
import { scrubToken } from "@/lib/scrub";
import { scrubEvent } from "@/lib/sentry-scrub";

const T = "a".repeat(32);
const U = `https://x.vn/t/${T}?q=1`;
const S = "https://x.vn/t/[token]?q=1";

describe("scrubToken", () => {
  it("masks the token", () => expect(scrubToken(U)).toBe(S));
  it("masks every occurrence", () => expect(scrubToken(`/t/${T} /t/${T}`)).toBe("/t/[token] /t/[token]"));
  it("leaves other strings alone", () => expect(scrubToken("https://x.vn/e/abc")).toBe("https://x.vn/e/abc"));
});

describe("scrubEvent", () => {
  it("scrubs url, referer, transaction and breadcrumbs", () => {
    const e = scrubEvent({
      request: { url: U, headers: { referer: U, Referer: U, other: "x" } },
      transaction: `GET /t/${T}`,
      breadcrumbs: [{ message: U, data: { url: U, from: `/t/${T}`, to: `/t/${T}`, n: 1 } }],
    });
    expect(e.request!.url).toBe(S);
    expect(e.request!.headers).toEqual({ referer: S, Referer: S, other: "x" });
    expect(e.transaction).toBe("GET /t/[token]");
    expect(e.breadcrumbs![0].message).toBe(S);
    expect(e.breadcrumbs![0].data).toEqual({ url: S, from: "/t/[token]", to: "/t/[token]", n: 1 });
  });
  it("tolerates an empty event", () => expect(scrubEvent({})).toEqual({}));
});
