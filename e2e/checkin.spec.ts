import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { randomUUID } from "node:crypto";
import { assertLocalSupabase, signInAs } from "./auth";

const env = { ...loadEnv("test", process.cwd(), "SUPABASE_"), ...process.env };
const url = env.SUPABASE_URL!;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

const email = `e2e-org-${randomUUID()}@test.local`;
const password = randomUUID();
const studentId = "E2E" + String(Date.now()).slice(-5);
const studentName = "Trần Thị Bình";
let ownerId: string;
let eventId: string;

test.beforeAll(async () => {
  assertLocalSupabase(url);
  const owner = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (owner.error) throw owner.error;
  ownerId = owner.data.user.id;
  const ev = await admin
    .from("events")
    .insert({ owner_id: ownerId, club_name: "CLB E2E", title: "Sự kiện điểm danh E2E", starts_at: new Date(Date.now() + 86400000).toISOString(), location: "Hội trường", capacity: 10 })
    .select("id")
    .single();
  if (ev.error) throw ev.error;
  eventId = ev.data.id;
  const t = await admin.rpc("register", {
    p_event: eventId,
    p_name: studentName,
    p_email: `e2e-st-${randomUUID()}@test.local`,
    p_student_id: studentId,
    p_class: "K67-E2E",
    p_faculty: "CNTT",
    p_notice_version: "v1",
  });
  if (t.error) throw t.error;
});

test.afterAll(async () => {
  if (eventId) await admin.from("events").delete().eq("id", eventId); // cascades tickets, members
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
});

/** Opens the search sheet and types the first 3 characters of the MSSV. */
async function search(page: Page) {
  await page.getByRole("button", { name: "Tìm theo tên / MSSV" }).click();
  await page.getByRole("searchbox", { name: "Họ tên hoặc MSSV" }).fill(studentId.slice(0, 3));
}

test("check-in flow: list, manual check-in, duplicate, live count", async ({ context, page }) => {
  await signInAs(context, email, password);
  const list = `/dashboard/events/${eventId}/attendees`;
  const scan = `/dashboard/events/${eventId}/scan`;

  await page.goto(list);
  await expect(page.getByRole("cell", { name: studentName })).toBeVisible();
  await expect(page.getByText(/^Đã vào 0 \/ 1 đã đăng ký$/)).toBeVisible();

  // Second scanner (same organizer) loads the search result before the first one checks in.
  const other = await context.newPage();
  await other.goto(scan);
  await search(other);
  const otherButton = other.getByRole("button", { name: "Điểm danh", exact: true });
  await expect(otherButton).toBeVisible();

  await page.goto(scan);
  await search(page);
  await page.getByRole("button", { name: "Điểm danh", exact: true }).click();
  const overlay = page.getByRole("button", { name: "Đóng kết quả, quét tiếp" });
  await expect(overlay.getByText("Mời vào", { exact: true })).toBeVisible();
  await expect(overlay.getByText(studentName)).toBeVisible();
  await expect(overlay).toBeHidden({ timeout: 5_000 }); // closes by itself after 2 s

  // Searching again shows the ticket as already in, without a check-in button.
  await search(page);
  await expect(page.getByText(/^Đã vào \d\d:\d\d$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Điểm danh", exact: true })).toHaveCount(0);

  // The other scanner's stale result tries the same ticket: rejected as already checked in.
  await otherButton.click();
  const otherOverlay = other.getByRole("button", { name: "Đóng kết quả, quét tiếp" });
  await expect(otherOverlay.getByText("Đã điểm danh", { exact: true })).toBeVisible();
  await expect(otherOverlay.getByText(/^lúc \d\d:\d\d, bởi /)).toBeVisible();
  await expect(other.getByRole("status").filter({ hasText: /^Đã điểm danh\. .+\. lúc \d\d:\d\d, bởi / })).toHaveCount(1);
  await other.close();

  await page.goto(list);
  await expect(page.getByText(/^Đã vào 1 \/ 1 đã đăng ký$/)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(studentName) }).getByRole("cell").filter({ hasText: /^\d\d:\d\d$/ })).toHaveCount(1);
  await expect(page.getByRole("row", { name: new RegExp(studentName) }).getByRole("cell", { name: email.split("@")[0], exact: true })).toBeVisible();
});
