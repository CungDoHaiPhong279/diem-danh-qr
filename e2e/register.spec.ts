import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { randomUUID } from "node:crypto";

// Seed env: .env.test.local locally, process env in CI.
const env = { ...loadEnv("test", process.cwd(), "SUPABASE_"), ...process.env };
const url = env.SUPABASE_URL!;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

const email = `e2e-${randomUUID()}@test.local`;
let ownerId: string;
let eventId: string;

test.beforeAll(async () => {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error(`e2e writes data: refusing non-local SUPABASE_URL`);
  const owner = await admin.auth.admin.createUser({ email, password: randomUUID(), email_confirm: true });
  if (owner.error) throw owner.error;
  ownerId = owner.data.user.id;
  const ev = await admin
    .from("events")
    .insert({ owner_id: ownerId, club_name: "CLB E2E", title: "Sự kiện E2E", starts_at: new Date(Date.now() + 86400000).toISOString(), location: "Hội trường", capacity: 10 })
    .select("id")
    .single();
  if (ev.error) throw ev.error;
  eventId = ev.data.id;
});

test.afterAll(async () => {
  if (eventId) await admin.from("events").delete().eq("id", eventId); // cascades tickets
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
});

async function register(page: import("@playwright/test").Page) {
  await page.goto(`/e/${eventId}`);
  await page.locator("[name=name]").fill("Nguyễn Văn An");
  await page.locator("[name=email]").fill(email);
  await page.locator("[name=student_id]").fill("E2E12345");
  await page.locator("[name=class_name]").fill("K67-E2E");
  await page.locator("[name=faculty]").fill("CNTT");
  await page.getByRole("checkbox").check();
  // Disabled until Turnstile (test key) issues a token; click auto-waits.
  await page.getByRole("button", { name: "Đăng ký và nhận vé" }).click({ timeout: 30_000 });
}

test("register shows ticket", async ({ page }) => {
  await register(page);
  await expect(page).toHaveURL(/\/t\/[0-9a-f]{32}$/);
  await expect(page.locator('img[alt="Mã QR vé"]')).toBeVisible();
  await expect(page.getByText(/^Mã vé: [A-Z0-9]{8}$/)).toBeVisible();
});

test("second registration says already registered", async ({ page }) => {
  await register(page);
  await expect(page.getByText("đã đăng ký sự kiện")).toBeVisible();
});

test("unknown token shows not-found page (noindex)", async ({ page }) => {
  // With cacheComponents the shell is sent first, so notFound() inside <Suspense> keeps HTTP 200
  // (https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes); Next marks it noindex instead.
  await page.goto(`/t/${"0".repeat(32)}`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.locator('img[alt="Mã QR vé"]')).toHaveCount(0);
});
