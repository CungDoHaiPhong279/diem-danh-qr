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
  it("scrubs token in every field of the event", () => {
    const p = `/t/${T}`;
    const e = scrubEvent({
      request: { url: U, headers: { referer: U, other: "x" } },
      transaction: `GET ${p}`,
      contexts: { nextjs: { request_path: p }, trace: { data: { "http.target": p } } },
      spans: [{ description: `GET ${p}`, data: { "url.full": U } }],
      exception: { values: [{ value: `bad ${p}` }] },
      breadcrumbs: [{ message: U, data: { url: U, n: 1 } }],
    });
    const s = JSON.stringify(e);
    expect(s).not.toContain(T);
    expect(e.contexts.nextjs.request_path).toBe("/t/[token]");
    expect(e.spans[0].data["url.full"]).toBe(S);
    expect(e.spans[0].description).toBe("GET /t/[token]");
    expect(e.exception.values[0].value).toBe("bad /t/[token]");
    expect(e.request.headers.other).toBe("x");
  });
  it("tolerates an empty event", () => expect(scrubEvent({})).toEqual({}));
  it("scrubs a streamed span (beforeSendSpan shape)", () => {
    const span = scrubEvent({ name: `GET /t/${T}`, attributes: { "url.full": U, "http.route": "/t/[token]" } });
    expect(JSON.stringify(span)).not.toContain(T);
    expect(span.attributes["url.full"]).toBe(S);
  });
});
