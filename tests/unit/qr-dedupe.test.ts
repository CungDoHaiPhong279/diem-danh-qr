import { describe, expect, test } from "vitest";
import { DEDUPE_MS, seenRecently } from "@/components/use-qr-scanner";

describe("seenRecently (last-seen dedupe)", () => {
  test("a code held in front of the camera never fires again", () => {
    const m = new Map([["A", 0]]);
    for (let t = 500; t < 10_000; t += 500) expect(seenRecently(m, "A", t)).toBe(true);
  });
  test("fires again after leaving the frame for DEDUPE_MS", () => {
    const m = new Map([["A", 0]]);
    expect(seenRecently(m, "A", DEDUPE_MS - 1)).toBe(true);
    expect(seenRecently(m, "A", 2 * DEDUPE_MS - 1)).toBe(false);
    expect(seenRecently(m, "B", 0)).toBe(false);
  });
});
