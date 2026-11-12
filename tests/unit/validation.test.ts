import { describe, expect, it } from "vitest";
import { parseEventForm } from "@/lib/validation";

function form(o: Record<string, string>) {
  const fd = new FormData();
  const base = { club_name: "CLB", title: "Sự kiện", starts_at: "2026-12-05T18:30", location: "Hội trường", capacity: "150" };
  for (const [k, v] of Object.entries({ ...base, ...o })) fd.set(k, v);
  return fd;
}

describe("parseEventForm", () => {
  it("parses start time as +07:00", () => {
    const r = parseEventForm(form({}));
    if (!r.ok) throw new Error("expected ok");
    expect(new Date(r.value.starts_at).toISOString()).toBe("2026-12-05T11:30:00.000Z");
    expect(r.value.capacity).toBe(150);
  });
  it.each(["0", "5001", "abc"])("rejects capacity %s", (c) => {
    const r = parseEventForm(form({ capacity: c }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.capacity).toBeTruthy();
  });
  it("requires title and club_name", () => {
    const r = parseEventForm(form({ title: "  ", club_name: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toBeTruthy();
      expect(r.errors.club_name).toBeTruthy();
    }
  });
});
