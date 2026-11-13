import { describe, expect, it, vi } from "vitest";
import { mapRegisterError } from "@/lib/register";

vi.mock("@/lib/supabase/admin", () => ({ admin: {} }));

describe("mapRegisterError", () => {
  it.each(["EVENT_NOT_FOUND", "EVENT_CLOSED", "EVENT_FULL", "ALREADY_REGISTERED"])("maps %s", (m) => {
    expect(mapRegisterError({ message: m })).toBe(m);
  });
  it.each(["tickets_event_email_key", "tickets_event_student_key"])("23505 on %s is a duplicate", (k) => {
    expect(mapRegisterError({ code: "23505", message: `duplicate key value violates unique constraint "${k}"` })).toBe(
      "ALREADY_REGISTERED",
    );
  });
  it("short_code collision and unknown errors are UNKNOWN", () => {
    expect(mapRegisterError({ code: "23505", message: 'violates "tickets_event_short_code_key"' })).toBe("UNKNOWN");
    expect(mapRegisterError({ message: "boom" })).toBe("UNKNOWN");
  });
});
