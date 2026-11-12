import { beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createEvent, createTestUser } from "./helpers";

let owner: string;
beforeAll(async () => {
  owner = (await createTestUser()).id;
});

const call = (client: typeof admin, event: string, email: string, sid: string) =>
  client.rpc("register", {
    p_event: event,
    p_name: "N",
    p_email: email,
    p_student_id: sid,
    p_class: "C",
    p_faculty: "F",
    p_notice_version: "v1",
  });

const count = async (event: string) =>
  (await admin.from("tickets").select("*", { count: "exact", head: true }).eq("event_id", event)).count;
const seats = async (event: string) =>
  (await admin.from("events").select("seats_taken").eq("id", event).single()).data!.seats_taken;

describe("register", () => {
  it("50 parallel into 10 seats", async () => {
    const ev = await createEvent(owner, { capacity: 10 });
    const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => call(admin, ev.id, `p${i}@x.com`, `S${i}`)));
    const failed = rs.filter((r) => r.error);
    expect(rs.length - failed.length).toBe(10);
    expect(failed.every((r) => r.error!.message === "EVENT_FULL")).toBe(true);
    expect(await seats(ev.id)).toBe(10);
    expect(await count(ev.id)).toBe(10);
  });

  it("same email different case", async () => {
    const ev = await createEvent(owner);
    expect((await call(admin, ev.id, "a@x.com", "A1")).error).toBeNull();
    expect((await call(admin, ev.id, "A@X.com", "A2")).error?.message).toBe("ALREADY_REGISTERED");
    expect(await count(ev.id)).toBe(1);
  });

  it("same student id", async () => {
    const ev = await createEvent(owner);
    await call(admin, ev.id, "a@x.com", "A1");
    expect((await call(admin, ev.id, "b@x.com", "A1")).error?.message).toBe("ALREADY_REGISTERED");
  });

  it("duplicate on full event", async () => {
    const ev = await createEvent(owner, { capacity: 1 });
    expect((await call(admin, ev.id, "a@x.com", "A1")).error).toBeNull();
    expect((await call(admin, ev.id, "a@x.com", "A1")).error?.message).toBe("ALREADY_REGISTERED");
  });

  it("parallel duplicates", async () => {
    const ev = await createEvent(owner, { capacity: 10 });
    await Promise.all(Array.from({ length: 5 }, () => call(admin, ev.id, "d@x.com", "D1")));
    expect(await count(ev.id)).toBe(1);
    expect(await seats(ev.id)).toBe(1);
  });

  it("closed event", async () => {
    const ev = await createEvent(owner, { registration_open: false });
    expect((await call(admin, ev.id, "a@x.com", "A1")).error?.message).toBe("EVENT_CLOSED");
  });

  it("token shape", async () => {
    const ev = await createEvent(owner);
    const { data, error } = await call(admin, ev.id, "t@x.com", "T1");
    expect(error).toBeNull();
    expect(data.token).toMatch(/^[0-9a-f]{32}$/);
    expect(data.short_code).toMatch(/^[0-9A-F]{8}$/);
    expect(data.consent_at).not.toBeNull();
  });

  it("anon cannot call register", async () => {
    const ev = await createEvent(owner);
    expect((await call(anon, ev.id, "a@x.com", "A1")).error).not.toBeNull();
  });
});
