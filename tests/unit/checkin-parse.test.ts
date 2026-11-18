import { describe, expect, test } from "vitest";
import { mapCheckinRow, parseTicketToken } from "@/lib/checkin";

const SITE = "https://diem-danh-qr-gamma.vercel.app";
const T = "a".repeat(32);
const AT = "2026-11-16T10:00:00Z";

describe("parseTicketToken", () => {
  test("accepts a ticket URL on our origin", () => {
    expect(parseTicketToken(`${SITE}/t/${T}`, SITE)).toBe(T);
  });
  test("rejects foreign hosts and non-ticket codes", () => {
    for (const raw of [`https://evil.com/t/${T}`, `${SITE}/t/${T.toUpperCase()}`, `${SITE}/t/${T}x`, `${SITE}/e/${T}`, "8935049501234", "", "not a url"]) {
      expect(parseTicketToken(raw, SITE)).toBeNull();
    }
  });
  test("ignores query and hash", () => {
    expect(parseTicketToken(`${SITE}/t/${T}?a=1`, SITE)).toBe(T);
    expect(parseTicketToken(`${SITE}/t/${T}#x`, SITE)).toBe(T);
  });
  test("bad siteUrl returns null instead of throwing", () => {
    expect(parseTicketToken(`${SITE}/t/${T}`, "")).toBeNull();
  });
});

describe("mapCheckinRow", () => {
  test("ok", () => {
    expect(mapCheckinRow({ result: "ok", name: "An", student_id: "1", checked_in_at: AT })).toEqual({ kind: "ok", name: "An", studentId: "1", checkedInAt: AT });
  });
  test("already", () => {
    expect(mapCheckinRow({ result: "already", name: "An", student_id: "1", checked_in_at: AT, checked_in_by_name: "Bình" })).toEqual({ kind: "already", name: "An", studentId: "1", checkedInAt: AT, by: "Bình" });
  });
  test("already with null checker falls back", () => {
    const r = mapCheckinRow({ result: "already", name: "An", student_id: null, checked_in_at: AT, checked_in_by_name: null });
    expect(r).toMatchObject({ kind: "already", by: "không rõ", studentId: null });
  });
  test("null name becomes empty string", () => {
    expect(mapCheckinRow({ result: "ok", name: null, student_id: null, checked_in_at: AT })).toMatchObject({ name: "" });
  });
  test.each(["not_found", "wrong_event", "cancelled"] as const)("%s", (reason) => {
    expect(mapCheckinRow({ result: reason })).toEqual({ kind: "invalid", reason });
  });
  test("unknown or missing result throws", () => {
    expect(() => mapCheckinRow({ result: "weird" })).toThrow();
    expect(() => mapCheckinRow({})).toThrow();
  });
});
