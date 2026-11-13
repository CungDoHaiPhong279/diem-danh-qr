import { expect, test } from "vitest";
import { NOTICE_VERSION } from "@/lib/constants";

test("NOTICE_VERSION", () => {
  expect(NOTICE_VERSION).toBe("2026-11-v1");
});
