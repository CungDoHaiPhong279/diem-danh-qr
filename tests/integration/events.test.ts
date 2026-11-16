import { describe, expect, it } from "vitest";
import { admin, createEvent, createTestUser } from "./helpers";

describe("organizer event management (user-client path)", () => {
  it("insert+select, toggle open, capacity below seats_taken -> 23514", async () => {
    const u = await createTestUser();
    const { data, error } = await u.client
      .from("events")
      .insert({ club_name: "C", title: "T", starts_at: "2026-12-05T18:30:00+07:00", location: "L", capacity: 10, owner_id: u.id })
      .select("id")
      .single();
    expect(error).toBeNull();
    const id = data!.id;

    const off = await u.client.from("events").update({ registration_open: false }).eq("id", id).select("id");
    expect(off.data).toHaveLength(1);
    const on = await u.client.from("events").update({ registration_open: true }).eq("id", id).select("id");
    expect(on.data).toHaveLength(1);

    await admin.from("events").update({ seats_taken: 5 }).eq("id", id);
    const low = await u.client.from("events").update({ capacity: 3 }).eq("id", id).select("id");
    expect(low.error?.code).toBe("23514");
  });
});

describe("purge_after trigger", () => {
  it("is starts_at + 30 days on insert and recomputed when starts_at changes", async () => {
    const u = await createTestUser();
    const ev = await createEvent(u.id, { starts_at: "2026-12-05T18:30:00+07:00" });
    expect(new Date(ev.purge_after!).getTime()).toBe(new Date("2027-01-04T18:30:00+07:00").getTime());

    const { data } = await admin.from("events").update({ starts_at: "2026-12-10T18:30:00+07:00" }).eq("id", ev.id).select("purge_after").single();
    expect(new Date(data!.purge_after).getTime()).toBe(new Date("2027-01-09T18:30:00+07:00").getTime());
  });
});
