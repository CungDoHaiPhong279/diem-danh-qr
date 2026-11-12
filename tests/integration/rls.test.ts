import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { admin, anon, createEvent, createTestUser } from "./helpers";

describe("schema and RLS", () => {
  it("profile is created for new user", async () => {
    const { id } = await createTestUser();
    const { data } = await admin.from("profiles").select().eq("id", id);
    expect(data).toHaveLength(1);
  });

  it("owner becomes organizer", async () => {
    const a = await createTestUser();
    const { data: ev, error } = await a.client
      .from("events")
      .insert({
        owner_id: a.id,
        club_name: "Club",
        title: "T",
        starts_at: new Date().toISOString(),
        location: "L",
        capacity: 10,
      })
      .select()
      .single();
    expect(error).toBeNull();
    const { data } = await admin.from("event_members").select().eq("event_id", ev!.id);
    expect(data).toMatchObject([{ event_id: ev!.id, user_id: a.id, role: "organizer" }]);
  });

  it("anon reads open event but not closed", async () => {
    const a = await createTestUser();
    const open = await createEvent(a.id);
    const closed = await createEvent(a.id, { registration_open: false });
    const o = await anon.from("events").select().eq("id", open.id);
    const c = await anon.from("events").select().eq("id", closed.id);
    expect(o.data).toHaveLength(1);
    expect(c.data).toHaveLength(0);
  });

  it("anon cannot read tickets", async () => {
    const a = await createTestUser();
    const ev = await createEvent(a.id);
    const { error } = await admin.from("tickets").insert({
      event_id: ev.id,
      name: "N",
      email: `${randomUUID()}@x.test`,
      student_id: "S1",
      token: randomUUID(),
      short_code: "AB12",
      consent_at: new Date().toISOString(),
      notice_version: "v1",
    });
    expect(error).toBeNull();
    const { data } = await anon.from("tickets").select();
    expect(data).toEqual([]);
  });

  it("other user cannot read or update", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const ev = await createEvent(a.id);
    await admin.from("tickets").insert({
      event_id: ev.id,
      name: "N",
      email: `${randomUUID()}@x.test`,
      token: randomUUID(),
      short_code: "CD34",
      consent_at: new Date().toISOString(),
      notice_version: "v1",
    });
    const t = await b.client.from("tickets").select().eq("event_id", ev.id);
    expect(t.data).toEqual([]);
    const u = await b.client.from("events").update({ title: "hacked" }).eq("id", ev.id).select();
    expect(u.data ?? []).toHaveLength(0);
    const { data } = await admin.from("events").select("title").eq("id", ev.id).single();
    expect(data!.title).toBe("Event");
  });

  it("owner cannot write seats_taken", async () => {
    const a = await createTestUser();
    const ev = await createEvent(a.id);
    const { error } = await a.client.from("events").update({ seats_taken: 5 }).eq("id", ev.id);
    expect(error?.code).toBe("42501");
  });
});
