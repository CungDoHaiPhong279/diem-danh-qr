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
    const already = rs.find((r) => r.data.result === "already")!.data;
    expect(already.checked_in_at).not.toBeNull();
    expect(already.checked_in_by_name).not.toBeNull();
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
    const nulls = { name: null, student_id: null, ticket_id: null, class_name: null, checked_in_at: null, checked_in_by_name: null };
    expect(r.data).toEqual({ result: "wrong_event", ...nulls });
    const { data } = await admin.from("tickets").select("checked_in_at").eq("id", t.id).single();
    expect(data!.checked_in_at).toBeNull();
    const { data: row } = await admin.from("checkin_events").select("ticket_id, scan_id").eq("event_id", ev.id).single();
    expect(row!.ticket_id).toBeNull();
    const replay = await checker.client.rpc("checkin", { p_event: ev.id, p_scan_id: row!.scan_id, p_token: t.token });
    expect(replay.data).toEqual({ result: "wrong_event", ...nulls });
  });

  it("manual checkin with a ticket of another event is wrong_event", async () => {
    const { ev, checker } = await setup();
    const other = await createEvent(owner.id);
    const t = await registerTicket(other.id);
    const r = await checker.client.rpc("checkin", { p_event: ev.id, p_scan_id: randomUUID(), p_ticket: t.id });
    expect(r.data).toMatchObject({ result: "wrong_event", name: null, student_id: null, ticket_id: null });
    const { data } = await admin.from("tickets").select("checked_in_at").eq("id", t.id).single();
    expect(data!.checked_in_at).toBeNull();
  });

  it("same scan_id in parallel: both ok, one log row", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id);
    const args = { p_event: ev.id, p_scan_id: randomUUID(), p_token: t.token };
    const rs = await Promise.all([checker.client.rpc("checkin", args), checker.client.rpc("checkin", args)]);
    expect(rs.map((r) => r.data.result)).toEqual(["ok", "ok"]);
    expect(await logCount(ev.id)).toBe(1);
  });

  it("replaying a scan_id from another event leaks nothing", async () => {
    const { ev, checker } = await setup();
    const t = await registerTicket(ev.id, { name: "Secret Name", student_id: "SECRET1" });
    const scanId = randomUUID();
    const r1 = await checker.client.rpc("checkin", { p_event: ev.id, p_scan_id: scanId, p_token: t.token });
    expect(r1.data.result).toBe("ok");
    const evB = await createEvent(owner.id);
    const tb = await registerTicket(evB.id);
    for (const token of [t.token, tb.token]) {
      const r = await owner.client.rpc("checkin", { p_event: evB.id, p_scan_id: scanId, p_token: token });
      expect(r.error?.message).toBe("BAD_REQUEST");
      expect(JSON.stringify(r)).not.toContain("Secret Name");
    }
    expect(await logCount(evB.id)).toBe(0);
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
    const t2 = await registerTicket(ev.id);
    const r2 = await scan(checker, ev.id, t2.token, { p_scanned_at: new Date(Date.now() + 3 * 86400000).toISOString() });
    expect(new Date(r2.data.checked_in_at).getTime()).toBeLessThanOrEqual(Date.now() + 5000);
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
    const other = await createEvent(owner.id);
    await registerTicket(other.id, { name: "Nguyen Other" });
    expect((await search("nguyen")).data).toHaveLength(1);
  });

  it("refuses non-members", async () => {
    const { checker } = await setup();
    const other = await createEvent(owner.id);
    const r = await checker.client.rpc("search_tickets", { p_event: other.id, p_query: "ab" });
    expect(r.error?.code).toBe("42501");
  });
});
