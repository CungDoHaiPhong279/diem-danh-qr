import { beforeAll, describe, expect, it } from "vitest";
import { admin, createEvent, createTestUser } from "./helpers";
import { getTicketByToken } from "@/lib/ticket";

let eventId: string;
let owner: string;
beforeAll(async () => {
  owner = (await createTestUser()).id;
  eventId = (await createEvent(owner, { title: "T", club_name: "CLB" })).id;
});

describe("getTicketByToken", () => {
  it("returns the ticket without email", async () => {
    const { data, error } = await admin.rpc("register", {
      p_event: eventId,
      p_name: "Nguyen A",
      p_email: "a@x.com",
      p_student_id: "S1",
      p_class: "C",
      p_faculty: "F",
      p_notice_version: "v1",
    });
    expect(error).toBeNull();
    const t = await getTicketByToken(data.token);
    expect(t).toMatchObject({ name: "Nguyen A", student_id: "S1", status: "valid", event: { title: "T", club_name: "CLB" } });
    expect(t!.short_code).toHaveLength(8);
    expect(t).not.toHaveProperty("email");
    expect(JSON.stringify(t)).not.toContain("a@x.com");
  });

  it("returns null for unknown or malformed token", async () => {
    expect(await getTicketByToken("0".repeat(32))).toBeNull();
    expect(await getTicketByToken("../x")).toBeNull();
  });
});
