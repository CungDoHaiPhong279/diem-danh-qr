import { expect, test } from "vitest";
import { safeNext } from "@/lib/safe-next";

test("safeNext keeps same-origin paths", () => {
  expect(safeNext("/invite/abc")).toBe("/invite/abc");
});

test("safeNext rejects anything else", () => {
  for (const bad of [null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/a\nb", "/a\rb", "/\t/evil.com", "/a\\b", "/a\u0000b", "/a\u007fb"]) expect(safeNext(bad)).toBe("/dashboard");
});

test("safeNext allows percent-encoded paths (no literal backslash or control char)", () => {
  expect(safeNext("/%5Cevil.com")).toBe("/%5Cevil.com");
});
