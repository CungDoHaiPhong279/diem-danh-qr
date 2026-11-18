import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { addMember, admin, anon, createEvent, createTestUser, registerTicket } from "./helpers";

type User = Awaited<ReturnType<typeof createTestUser>>;
let owner: User;
beforeAll(async () => {
  owner = await createTestUser();
});

const invite = async (ev: string) => {
  const r = await owner.client.rpc("create_checker_invite", { p_event: ev });
  expect(r.error).toBeNull();
  return r.data as string;
};
const accept = (u: User, token: string) => u.client.rpc("accept_checker_invite", { p_token: token });

describe("checker invites", () => {
  it("organizer creates, user accepts", async () => {
    const ev = await createEvent(owner.id);
    const token = await invite(ev.id);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    const b = await createTestUser();
    const r = await accept(b, token);
    expect(r.error).toBeNull();
    expect(r.data).toBe(ev.id);
    const m = await admin.from("event_members").select("role").eq("event_id", ev.id).eq("user_id", b.id).single();
    expect(m.data?.role).toBe("checker");
    const t = await registerTicket(ev.id);
    const c = await b.client.rpc("checkin", { p_event: ev.id, p_scan_id: randomUUID(), p_token: t.token });
    expect(c.error).toBeNull();
    expect(c.data.result).toBe("ok");
  });

  it("new invite revokes old", async () => {
    const ev = await createEvent(owner.id);
    const t1 = await invite(ev.id);
    const t2 = await invite(ev.id);
    const b = await createTestUser();
    expect((await accept(b, t1)).error?.message).toContain("INVITE_INVALID");
    expect((await accept(b, t2)).error).toBeNull();
  });

  it("concurrent creates leave exactly one active invite", async () => {
    const ev = await createEvent(owner.id);
    const rs = await Promise.all(Array.from({ length: 4 }, () => owner.client.rpc("create_checker_invite", { p_event: ev.id })));
    rs.forEach((r) => expect(r.error).toBeNull());
    const { data } = await admin.from("event_invites").select("token, revoked_at, expires_at").eq("event_id", ev.id);
    const active = (data ?? []).filter((i) => i.revoked_at === null && new Date(i.expires_at) > new Date());
    expect(data).toHaveLength(4);
    expect(active).toHaveLength(1);
  });

  it("expired invite", async () => {
    const ev = await createEvent(owner.id);
    const token = await invite(ev.id);
    await admin.from("event_invites").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token", token);
    const b = await createTestUser();
    expect((await accept(b, token)).error?.message).toContain("INVITE_INVALID");
  });

  it("revoked invite", async () => {
    const ev = await createEvent(owner.id);
    const token = await invite(ev.id);
    const r = await owner.client.rpc("revoke_checker_invites", { p_event: ev.id });
    expect(r.error).toBeNull();
    const b = await createTestUser();
    expect((await accept(b, token)).error?.message).toContain("INVITE_INVALID");
  });

  it("organizer is not downgraded by accepting", async () => {
    const ev = await createEvent(owner.id);
    const token = await invite(ev.id);
    expect((await accept(owner, token)).error).toBeNull();
    const m = await admin.from("event_members").select("role").eq("event_id", ev.id).eq("user_id", owner.id).single();
    expect(m.data?.role).toBe("organizer");
  });

  it("checker cannot create invites or see them", async () => {
    const ev = await createEvent(owner.id);
    await invite(ev.id);
    const c = await createTestUser();
    await addMember(ev.id, c.id, "checker");
    expect((await c.client.rpc("create_checker_invite", { p_event: ev.id })).error?.code).toBe("42501");
    expect((await c.client.rpc("revoke_checker_invites", { p_event: ev.id })).error?.code).toBe("42501");
    const s = await c.client.from("event_invites").select("*");
    expect(s.data).toEqual([]);
    const o = await owner.client.from("event_invites").select("*").eq("event_id", ev.id);
    expect(o.data).toHaveLength(1);
  });

  it("remove_checker", async () => {
    const ev = await createEvent(owner.id);
    const b = await createTestUser();
    await addMember(ev.id, b.id, "checker");
    const out = await createTestUser();
    expect((await out.client.rpc("remove_checker", { p_event: ev.id, p_user: b.id })).error?.code).toBe("42501");
    expect((await owner.client.rpc("remove_checker", { p_event: ev.id, p_user: b.id })).error).toBeNull();
    const c = await b.client.rpc("checkin", { p_event: ev.id, p_scan_id: randomUUID(), p_token: "0".repeat(32) });
    expect(c.error?.code).toBe("42501");
    expect((await owner.client.rpc("remove_checker", { p_event: ev.id, p_user: owner.id })).error).toBeNull();
    const m = await admin.from("event_members").select("role").eq("event_id", ev.id).eq("user_id", owner.id).single();
    expect(m.data?.role).toBe("organizer");
  });

  it("member_names", async () => {
    const ev = await createEvent(owner.id);
    const b = await createTestUser();
    await addMember(ev.id, b.id, "checker");
    const r = await b.client.rpc("member_names", { p_event: ev.id });
    expect(r.error).toBeNull();
    expect(r.data.map((x: { user_id: string }) => x.user_id).sort()).toEqual([owner.id, b.id].sort());
    expect(r.data.find((x: { user_id: string }) => x.user_id === b.id).role).toBe("checker");
    r.data.forEach((x: { name: string }) => expect(x.name).toBeTruthy());
    const out = await createTestUser();
    expect((await out.client.rpc("member_names", { p_event: ev.id })).error?.code).toBe("42501");
  });

  it("anon cannot accept or preview", async () => {
    const ev = await createEvent(owner.id);
    const token = await invite(ev.id);
    expect((await anon.rpc("accept_checker_invite", { p_token: token })).error).not.toBeNull();
    expect((await anon.rpc("invite_preview", { p_token: token })).error).not.toBeNull();
  });

  it("invite_preview", async () => {
    const ev = await createEvent(owner.id, { club_name: "CLB X", title: "Su kien Y" });
    const token = await invite(ev.id);
    const b = await createTestUser();
    const ok = await b.client.rpc("invite_preview", { p_token: token });
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual([{ club_name: "CLB X", title: "Su kien Y" }]);
    expect((await b.client.rpc("invite_preview", { p_token: "not-a-token" })).data).toEqual([]);
    await owner.client.rpc("revoke_checker_invites", { p_event: ev.id });
    expect((await b.client.rpc("invite_preview", { p_token: token })).data).toEqual([]);
  });
});
