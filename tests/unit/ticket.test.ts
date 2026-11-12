import { expect, test, vi } from "vitest";
import { isValidToken, ticketUrl } from "@/lib/ticket";

test("isValidToken", () => {
  expect(isValidToken("a".repeat(32))).toBe(true);
  expect(isValidToken("A".repeat(32))).toBe(false);
  expect(isValidToken("a".repeat(31))).toBe(false);
  expect(isValidToken("../x")).toBe(false);
});

test("ticketUrl", () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
  expect(ticketUrl("ab".repeat(16))).toBe(`https://example.test/t/${"ab".repeat(16)}`);
});
