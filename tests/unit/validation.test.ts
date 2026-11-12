import { describe, expect, it } from "vitest";
import { parseEventForm, parseRegistration } from "@/lib/validation";

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

describe("parseRegistration", () => {
  const reg = (o: Record<string, string> = {}) => {
    const fd = new FormData();
    const base = { name: "Nguyễn An", email: "an@x.com", student_id: "AB1234", class_name: "K65", faculty: "CNTT", consent: "on" };
    for (const [k, v] of Object.entries({ ...base, ...o })) fd.set(k, v);
    return fd;
  };
  it("normalizes email", () => {
    const r = parseRegistration(reg({ email: " An@X.com " }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.email).toBe("an@x.com");
    expect(parseRegistration(reg({ email: "a@b" })).ok).toBe(false);
  });
  it("keeps leading zeros", () => {
    const r = parseRegistration(reg({ student_id: " 0012 345 " }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.student_id).toBe("0012345");
    expect(parseRegistration(reg({ student_id: "ab-12" })).ok).toBe(false);
  });
  it("normalizes name to NFC", () => {
    const r = parseRegistration(reg({ name: "Nguyễn" }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.name).toBe("Nguyễn".normalize("NFC"));
    expect(parseRegistration(reg({ name: "A" })).ok).toBe(false);
  });
  it("requires consent", () => {
    const fd = reg();
    fd.delete("consent");
    const r = parseRegistration(fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.consent).toBe("Bạn cần đồng ý để đăng ký.");
  });
});
