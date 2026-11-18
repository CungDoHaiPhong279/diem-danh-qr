import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { addMember, admin, anon, createEvent, createTestUser, registerTicket } from "./helpers";

type User = Awaited<ReturnType<typeof createTestUser>>;
let owner: User;
beforeAll(async () => {
  owner = await createTestUser();
});

async function setup() {
  const checker = await createTestUser();
  const ev = await createEvent(owner.id);
  await addMember(ev.id, checker.id, "checker");
  return { ev, checker };
}
const scan = (u: User, event: string, token: string, extra: Record<string, unknown> = {}) =>
  u.client.rpc("checkin", { p_event: event, p_scan_id: randomUUID(), p_token: token, ...extra });
const logCount = async (event: string) =>
  (await admin.from("checkin_events").select("*", { count: "exact", head: true }).eq("event_id", event)).count;

describe("checkin", () => {
  it("ok then already", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id, { name: "An" });
    const r1 = await scan(checker, ev.id, t.token);
    expect(r1.error).toBeNull();
    expect(r1.data.result).toBe("ok");
    expect(r1.data.name).toBe("An");
    const r2 = await scan(checker, ev.id, t.token);
    expect(r2.data.result).toBe("already");
    expect(r2.data.checked_in_by_name).not.toBeNull();
    expect(r2.data.checked_in_at).not.toBeNull();
  });

  it("parallel checkins: exactly one ok", async () => {
    const { ev, checker } = await setup();
    const c2 = await createTestUser();
    await addMember(ev.id, c2.id, "checker");
    const t = await registerTicket(ev.id);
    const rs = await Promise.all([scan(checker, ev.id, t.token), scan(c2, ev.id, t.token)]);
    expect(rs.map((r) => r.data.result).sort()).toEqual(["already", "ok"]);
    expect(await logCount(ev.id)).toBe(2);
  });

  it("replaying a scan_id returns the original result", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id);
    const args = { p_event: ev.id, p_scan_id: randomUUID(), p_token: t.token };
    const r1 = await checker.client.rpc("checkin", args);
    const r2 = await checker.client.rpc("checkin", args);
    expect(r1.data.result).toBe("ok");
    expect(r2.data).toEqual(r1.data);
    expect(await logCount(ev.id)).toBe(1);
  });

  it("wrong event hides data", async () => {
    const { ev, checker } = await setup();
    const other = await createEvent(owner.id);
    const t = await registerTicket(other.id);
    const r = await scan(checker, ev.id, t.token);
    expect(r.data).toMatchObject({ result: "wrong_event", name: null, student_id: null, ticket_id: null });
    const { data } = await admin.from("tickets").select("checked_in_at").eq("id", t.id).single();
    expect(data!.checked_in_at).toBeNull();
  });

  it("cancelled", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id);
    await admin.from("tickets").update({ status: "cancelled" }).eq("id", t.id);
    const r = await scan(checker, ev.id, t.token);
    expect(r.data.result).toBe("cancelled");
    const { data } = await admin.from("tickets").select("checked_in_at").eq("id", t.id).single();
    expect(data!.checked_in_at).toBeNull();
  });

  it("not found", async () => {
    const { ev, checker } = await setup();
    const r = await scan(checker, ev.id, randomUUID().replaceAll("-", ""));
    expect(r.data.result).toBe("not_found");
  });

  it("manual by ticket id", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id);
    const r = await checker.client.rpc("checkin", { p_event: ev.id, p_scan_id: randomUUID(), p_ticket: t.id });
    expect(r.data.result).toBe("ok");
    const { data } = await admin.from("checkin_events").select("method").eq("ticket_id", t.id).single();
    expect(data!.method).toBe("manual");
  });

  it("rejects both or neither of token/ticket", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id);
    const both = await checker.client.rpc("checkin", { p_event: ev.id, p_scan_id: randomUUID(), p_token: t.token, p_ticket: t.id });
    const none = await checker.client.rpc("checkin", { p_event: ev.id, p_scan_id: randomUUID() });
    expect(both.error?.message).toBe("BAD_REQUEST");
    expect(none.error?.message).toBe("BAD_REQUEST");
  });

  it("non-member is refused", async () => {
    const { checker } = await setup();
    const other = await createEvent(owner.id);
    const t = await registerTicket(other.id);
    const r = await scan(checker, other.id, t.token);
    expect(r.error?.code).toBe("42501");
    const a = await anon.rpc("checkin", { p_event: other.id, p_scan_id: randomUUID(), p_token: t.token });
    expect(a.error).not.toBeNull();
    const { data } = await admin.from("tickets").select("checked_in_at").eq("id", t.id).single();
    expect(data!.checked_in_at).toBeNull();
  });

  it("scanned_at clamped", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id);
    const r = await scan(checker, ev.id, t.token, { p_scanned_at: new Date(Date.now() - 3 * 86400000).toISOString() });
    expect(r.data.result).toBe("ok");
    expect(new Date(r.data.checked_in_at).getTime()).toBeGreaterThanOrEqual(Date.now() - 86400000 - 5000);
  });

  it("composite FK", async () => {
    const { ev } = await setup();
    const other = await createEvent(owner.id);
    const t = await registerTicket(other.id);
    const { error } = await admin
      .from("checkin_events")
      .insert({ event_id: ev.id, ticket_id: t.id, result: "ok", scan_id: randomUUID() });
    expect(error?.code).toBe("23503");
  });

  it("checker cannot update tickets directly", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id);
    await checker.client.from("tickets").update({ checked_in_at: new Date().toISOString() }).eq("id", t.id);
    const { data } = await admin.from("tickets").select("checked_in_at").eq("id", t.id).single();
    expect(data!.checked_in_at).toBeNull();
  });
});

describe("search_tickets", () => {
  it("matches unaccented name, escapes wildcards, hides email", async () => {
    const { ev, checker } = await setup();
    await registerTicket(ev.id, { name: "Nguyễn Văn An", student_id: "20250123" });
    await registerTicket(ev.id, { name: "Tran B", student_id: "20260999" });
    const search = (q: string) => checker.client.rpc("search_tickets", { p_event: ev.id, p_query: q });
    const r = await search("nguyen");
    expect(r.data).toHaveLength(1);
    expect(r.data[0]).not.toHaveProperty("email");
    expect((await search("%")).data).toHaveLength(0);
    expect((await search("%%")).data).toHaveLength(0);
    expect((await search("_a")).data).toHaveLength(0);
    expect((await search("2025")).data).toHaveLength(1);
    expect((await search("n")).data).toHaveLength(0);
  });

  it("refuses non-members", async () => {
    const { checker } = await setup();
    const other = await createEvent(owner.id);
    const r = await checker.client.rpc("search_tickets", { p_event: other.id, p_query: "ab" });
    expect(r.error?.code).toBe("42501");
  });
});
