import { describe, expect, it } from "vitest";
import { addMember, admin, createEvent, createTestUser, registerTicket } from "./helpers";

describe("ticket column privacy", () => {
  it("members can read allowed columns but not email or token", async () => {
    const owner = await createTestUser();
    const checker = await createTestUser();
    const ev = await createEvent(owner.id);
    await addMember(ev.id, checker.id, "checker");
    await registerTicket(ev.id, { name: "An" });

    for (const who of [owner, checker]) {
      const ok = await who.client.from("tickets").select("id, name, student_id, checked_in_at").eq("event_id", ev.id);
      expect(ok.error).toBeNull();
      expect(ok.data).toHaveLength(1);
      for (const col of ["email", "token", "*"]) {
        const bad = await who.client.from("tickets").select(col).eq("event_id", ev.id);
        expect(bad.error?.code, col).toBe("42501");
      }
    }
  });

  it("search_tickets skips cancelled tickets", async () => {
    const owner = await createTestUser();
    const ev = await createEvent(owner.id);
    const t = await registerTicket(ev.id, { name: "Huỷ Vé", student_id: "77001" });
    await registerTicket(ev.id, { name: "Còn Vé", student_id: "77002" });
    await admin.from("tickets").update({ status: "cancelled" }).eq("id", t.id);
    const { data, error } = await owner.client.rpc("search_tickets", { p_event: ev.id, p_query: "770" });
    expect(error).toBeNull();
    expect(data.map((r: { student_id: string }) => r.student_id)).toEqual(["77002"]);
  });
});
