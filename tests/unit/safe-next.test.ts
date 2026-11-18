import { expect, test } from "vitest";
import { safeNext } from "@/lib/safe-next";

test("safeNext keeps same-origin paths", () => {
  expect(safeNext("/invite/abc")).toBe("/invite/abc");
});

test("safeNext rejects anything else", () => {
  for (const bad of [null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/a\nb", "/a\rb"]) expect(safeNext(bad)).toBe("/dashboard");
});
