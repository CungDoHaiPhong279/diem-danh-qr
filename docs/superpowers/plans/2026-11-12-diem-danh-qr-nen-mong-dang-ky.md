# Điểm danh QR — Kế hoạch 1: Nền móng, đăng ký, vé QR (tuần 1–2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một web public trên Vercel nơi ban tổ chức đăng nhập Google, tạo sự kiện, và sinh viên đăng ký không cần tài khoản rồi nhận vé QR ngay trên màn hình; số chỗ không bao giờ vượt, không đăng ký trùng.

**Architecture:** Next.js 16 App Router trên Vercel (vùng `sin1`), Supabase Postgres + Auth (vùng Singapore). Mọi quy tắc đúng/sai nằm trong Postgres: ràng buộc, RLS, và hàm `register` chạy trong một transaction. Server Action gọi `register` bằng khóa service-role phía máy chủ sau khi kiểm Turnstile; trình duyệt không bao giờ ghi trực tiếp vào `tickets`.

**Tech Stack:** Next.js 16, TypeScript, `@supabase/supabase-js` + `@supabase/ssr`, Supabase CLI (Postgres cục bộ), Vitest 5, Playwright 1.65, `qrcode`, `barcode-detector`, `@sentry/nextjs`, Cloudflare Turnstile, GitHub Actions.

**Spec:** `C:\Users\cungt\Downloads\MVP web điểm danh QR.md` cộng mục "Sửa đổi so với spec" bên dưới (mục này thắng spec khi mâu thuẫn).

## Sửa đổi so với spec

1. Mục tiêu tách đôi: **(a)** web public, đủ test + CI sau 6 tuần — kế hoạch này và hai kế hoạch sau; **(b)** pilot CLB thật — có thể trượt sang tháng 3/2027 vì thi cuối kỳ và Tết.
2. `register` kiểm tra trùng **trước** khi tăng bộ đếm; token sinh bằng `extensions.gen_random_bytes` (pgcrypto nằm ở schema `extensions` trên Supabase).
3. `register` chỉ cấp quyền cho `service_role`; anon gọi RPC trực tiếp sẽ bỏ qua được Turnstile.
4. Chống bot bằng Turnstile; không giới hạn chặt theo IP (cả hội trường chung một IP).
5. Ban tổ chức và người soát vé **chỉ đăng nhập Google** (email + mật khẩu cần thư xác nhận, đụng giới hạn 2 thư/giờ).
6. File nộp Đoàn là `.xlsx`, cột MSSV dạng text (Kế hoạch 3). MSSV luôn lưu là `text`, giữ số 0 ở đầu.
7. `checkin_events` có thêm cột `event_id` để viết RLS không cần join.
8. Cột `events.seats_taken` không được ban tổ chức sửa trực tiếp (thu hồi quyền UPDATE theo cột).

## Global Constraints

- Node.js 24 LTS; `next@16.x` (spec: 16.4.6 mới nhất ngày 11/11/2026), Vitest 5.1.x, `@playwright/test` 1.65.x, `@sentry/nextjs` 11.x.
- Giao diện, thông báo lỗi tiếng Việt; mã, tên bảng, tên hàm tiếng Anh.
- Token vé: 32 ký tự hex thường (128 bit) — regex `^[0-9a-f]{32}$`. QR chứa URL `${NEXT_PUBLIC_SITE_URL}/t/<token>`, mức sửa lỗi M, rộng ≥ 256 px, lề trắng 4 module.
- **Không request GET nào được thay đổi dữ liệu.**
- `SUPABASE_SERVICE_ROLE_KEY` chỉ được import trong `lib/supabase/admin.ts`, file này có `import "server-only"`.
- Chỉ thu: họ tên, email, MSSV, lớp, khoa. Không số điện thoại, không công cụ phân tích hành vi.
- Ô đồng ý không tích sẵn; lưu `consent_at` (giờ máy chủ) và `notice_version`. Giá trị hiện tại: `NOTICE_VERSION = "2026-11-v1"`.
- Thời gian người dùng nhập hiểu theo giờ Việt Nam (`+07:00`); lưu `timestamptz`.
- Supabase cục bộ chạy bằng Docker trên máy 16 GB: dùng `supabase start -x` để tắt dịch vụ không cần (kiểm tra tên dịch vụ bằng `supabase start --help`), và `supabase stop` khi xong việc. Bài test nặng chạy chính trên GitHub Actions.
- Commit: **không** thêm dòng `Co-Authored-By` hay bất kỳ dòng ghi công AI nào. Hỏi người dùng trước mỗi commit/push.
- Test không được tạo user trên project Supabase thật — chỉ trên Supabase cục bộ.
- Chưa kiểm chứng, phải đối chiếu tài liệu chính thức khi làm: API `@supabase/ssr` cho Next 16, tên file `proxy.ts` (Next 16 đổi từ `middleware.ts`), tên khóa trong `supabase status -o env`, `setZXingModuleOverrides` của `barcode-detector`, khóa test của Turnstile.

## Review Focus

1. **Người đã đăng ký gửi lại khi sự kiện đã đầy** → phải nhận "bạn đã đăng ký", không phải "hết chỗ". Test: `register.test.ts › duplicate on full event`.
2. **Email khác hoa/thường hoặc có khoảng trắng** (`" An@X.com "` với `"an@x.com"`) → bị coi là trùng. Test: `validation.test.ts › normalizes email` + `register.test.ts › same email different case`.
3. **MSSV có số 0 ở đầu hoặc khoảng trắng** (`" 0012 345 "`) → lưu đúng `"0012345"`, không thành số. Test: `validation.test.ts › keeps leading zeros`.
4. **Giờ sự kiện nhập ở form `datetime-local`** khi máy chủ Vercel chạy UTC → không được lệch 7 giờ. Test: `validation.test.ts › parses start time as +07:00`.
5. **Tên tiếng Việt gõ dạng NFD (macOS) và NFC (Windows)** → lưu thống nhất NFC để Kế hoạch 2 tìm theo tên được. Test: `validation.test.ts › normalizes name to NFC`.

---

## Cấu trúc file

```
app/
  layout.tsx                      # khung chung, lang="vi"
  page.tsx                        # trang giới thiệu ngắn + nút đăng nhập
  login/page.tsx                  # nút "Đăng nhập bằng Google" + nhắc mở bằng Safari/Chrome
  auth/callback/route.ts          # đổi code OAuth lấy phiên
  dashboard/page.tsx              # danh sách sự kiện của tôi
  dashboard/events/new/page.tsx   # form tạo sự kiện
  dashboard/events/actions.ts     # createEvent (Server Action)
  dashboard/events/[id]/page.tsx  # link đăng ký, QR của link, số đã đăng ký
  e/[id]/page.tsx                 # form đăng ký công khai
  e/[id]/actions.ts               # submitRegistration (Server Action)
  t/[token]/page.tsx              # trang vé
  privacy/page.tsx                # thông báo quyền riêng tư (NOTICE_VERSION)
  api/health/route.ts             # truy vấn DB thật, giữ project Supabase không bị tạm dừng
  scan-test/page.tsx              # bản thử máy quét (Task 9)
lib/
  supabase/server.ts              # client theo cookie (người đã đăng nhập)
  supabase/admin.ts               # client service-role, server-only
  validation.ts                   # parseRegistration, parseEventForm
  register.ts                     # registerTicket, mapRegisterError
  turnstile.ts                    # verifyTurnstile
  ticket.ts                       # isValidToken, ticketUrl, getTicketByToken
  scrub.ts                        # scrubToken cho Sentry
  constants.ts                    # NOTICE_VERSION
proxy.ts                          # làm mới phiên Supabase, chặn /dashboard khi chưa đăng nhập
supabase/migrations/
  20261112000100_schema.sql       # 5 bảng, RLS, trigger
  20261112000200_register.sql     # hàm register
tests/unit/*.test.ts
tests/integration/helpers.ts, *.test.ts
e2e/register.spec.ts
.github/workflows/ci.yml, .github/dependabot.yml
vercel.json
```

---

## Việc người dùng tự làm (song song, trước Task 4 và Task 8)

Mỗi bước cần tài khoản của bạn; không đưa khóa thật vào chat hay vào repo.

1. Tạo repo GitHub riêng tư `diem-danh-qr`.
2. Supabase: tạo hai project `diem-danh-prod` và `diem-danh-staging`, vùng **Singapore**.
3. Google Cloud Console: tạo OAuth Client (Web). Redirect URI là `https://<ref>.supabase.co/auth/v1/callback` cho từng project. Bật Google trong Supabase › Authentication › Providers.
4. Supabase › Authentication › URL Configuration: Site URL là domain Vercel, thêm `http://localhost:3000/**` vào Redirect URLs.
5. Cloudflare: tạo widget Turnstile, lấy site key và secret key.
6. Sentry: tạo project Next.js.
7. Vercel: import repo, chọn Hobby, khai báo biến môi trường ở mục "Biến môi trường" bên dưới.

**Biến môi trường:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`. Ghi tên (không ghi giá trị) vào `.env.example`.

---

### Task 1: Khung dự án, kiểm tra tĩnh, CI tối thiểu

**Files:**
- Create: toàn bộ khung do `create-next-app` sinh; `vitest.config.ts`; `tests/unit/smoke.test.ts`; `.github/workflows/ci.yml`; `.github/dependabot.yml`; `vercel.json`; `.env.example`; `lib/constants.ts`

**Interfaces:**
- Produces: script npm `typecheck`, `lint`, `test` (chỉ `tests/unit`), `test:int` (chỉ `tests/integration`), `e2e`; hằng `NOTICE_VERSION` trong `lib/constants.ts`.

- [ ] **Step 1:** Trong thư mục dự án trống: `git init`, rồi `npx create-next-app@16 . --ts --app --eslint --tailwind --no-src-dir --import-alias "@/*" --use-npm --yes`.
- [ ] **Step 2:** `npm i -D vitest@5` và thêm script: `"typecheck": "tsc --noEmit"`, `"test": "vitest run tests/unit"`, `"test:int": "vitest run tests/integration"`, `"e2e": "playwright test"`. Đặt `lang="vi"` trong `app/layout.tsx`.
- [ ] **Step 3:** Viết `tests/unit/smoke.test.ts`: `expect(NOTICE_VERSION).toBe("2026-11-v1")`. Chạy `npm test`; FAIL vì chưa có `lib/constants.ts`.
- [ ] **Step 4:** Tạo `lib/constants.ts` export `NOTICE_VERSION`. Chạy `npm run typecheck && npm run lint && npm test`; tất cả PASS.
- [ ] **Step 5:** Tạo `vercel.json` gồm `{"regions": ["sin1"], "crons": [{"path": "/api/health", "schedule": "0 3 * * *"}]}`; route health sẽ có ở Task 8. Tạo `.github/dependabot.yml` cho npm, chạy hằng tuần. Tạo `ci.yml` với job `check` (Node 24): `npm ci`, `typecheck`, `lint`, `test`.
- [ ] **Step 6:** Commit `chore: scaffold Next.js app with CI` (hỏi trước, không có dòng ghi công).

---

### Task 2: Lược đồ, RLS và trigger

**Files:**
- Create: `supabase/config.toml` (qua `npx supabase init`), `supabase/migrations/20261112000100_schema.sql`, `tests/integration/helpers.ts`, `tests/integration/rls.test.ts`
- Modify: `.github/workflows/ci.yml` (thêm job `integration`)

**Interfaces:**
- Produces (SQL): các bảng `profiles`, `events`, `event_members`, `tickets`, `checkin_events`; hàm `public.is_event_member(p_event uuid, p_roles text[]) returns boolean` (security definer, stable); trigger tạo `profiles` khi có `auth.users` mới; trigger thêm chủ sự kiện vào `event_members` với vai trò `organizer` sau khi insert `events`.
- Produces (TS, `tests/integration/helpers.ts`): `admin: SupabaseClient` (service-role), `anon: SupabaseClient`, `createTestUser(): Promise<{ id: string; client: SupabaseClient }>` (admin `createUser` với `email_confirm: true` rồi `signInWithPassword`; chỉ chạy cục bộ), `createEvent(ownerId: string, overrides?: Partial<EventRow>): Promise<EventRow>` (insert bằng admin).
- Biến test: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, lấy từ `npx supabase status -o env` (đối chiếu tên khóa thật mà CLI in ra).

**Cột và ràng buộc** (bổ sung cho bảng trong spec):

| Bảng | Quyết định |
|---|---|
| `events` | `id uuid default gen_random_uuid()`, `owner_id uuid not null references auth.users`, `capacity int check (capacity between 1 and 5000)`, `seats_taken int not null default 0 check (seats_taken >= 0 and seats_taken <= capacity)`, `registration_open bool not null default true`, `purge_after timestamptz` |
| `tickets` | `student_id text`, `email text not null`, `token text not null unique`, `short_code text not null`, `consent_at timestamptz not null`, `notice_version text not null`, `status text default 'valid'`, `source text default 'online'`. Index tên cố định: `tickets_event_email_key unique (event_id, email)`, `tickets_event_student_key unique (event_id, student_id) where student_id <> ''`, `tickets_event_short_code_key unique (event_id, short_code)` |
| `checkin_events` | thêm `event_id uuid not null`; `scan_id uuid unique` |

**RLS** (bật trên cả 5 bảng):
- `profiles`: select và update khi `id = auth.uid()`.
- `events`: select cho `anon, authenticated` khi `registration_open or is_event_member(id, '{organizer,checker}')`; insert cho `authenticated` với check `owner_id = auth.uid()`; update khi `is_event_member(id, '{organizer}')`; delete khi `owner_id = auth.uid()`. `revoke update on events from authenticated`, sau đó `grant update (club_name, title, starts_at, location, capacity, registration_open, purge_after)`.
- `event_members`: select khi `user_id = auth.uid() or is_event_member(event_id, '{organizer}')`. Không có policy ghi.
- `tickets`, `checkin_events`: select khi `is_event_member(event_id, '{organizer,checker}')`. Không có policy ghi, không có policy nào cho `anon`.

- [ ] **Step 1:** `npx supabase init`; `npx supabase start -x <dịch vụ không cần>`; xuất biến test vào `.env.test.local` (đã có trong `.gitignore`).
- [ ] **Step 2:** Viết `tests/integration/rls.test.ts` với các test:
  - `profile is created for new user`: sau `createTestUser()` thì `admin.from('profiles').select().eq('id', id)` có 1 dòng.
  - `owner becomes organizer`: user A insert event bằng client của mình, `event_members` có `(event, A, 'organizer')`.
  - `anon reads open event but not closed`: event `registration_open=false` → `anon` select ra 0 dòng; event mở → 1 dòng.
  - `anon cannot read tickets`: admin insert 1 vé; `anon.from('tickets').select()` trả `[]`.
  - `other user cannot read or update`: user B select vé của sự kiện A ra `[]`; B update `title` của sự kiện A thì 0 dòng bị đổi.
  - `owner cannot write seats_taken`: A update `seats_taken` → `error.code === '42501'`.
- [ ] **Step 3:** Chạy `npm run test:int`; FAIL (chưa có bảng).
- [ ] **Step 4:** Viết migration theo bảng và danh sách RLS trên. `is_event_member` dùng `security definer set search_path = public` để policy của `event_members` không gọi đệ quy chính nó. Áp bằng `npx supabase db reset`.
- [ ] **Step 5:** Chạy `npm run test:int`; tất cả PASS.
- [ ] **Step 6:** Thêm job `integration` vào CI: `supabase/setup-cli` (kiểm tra tên action hiện hành), `supabase start`, xuất biến, `npm run test:int`.
- [ ] **Step 7:** Commit `feat(db): schema, RLS and membership triggers`.

---

### Task 3: Hàm `register` — số chỗ và chống trùng

**Files:**
- Create: `supabase/migrations/20261112000200_register.sql`, `lib/register.ts`, `tests/integration/register.test.ts`, `tests/unit/register.test.ts`

**Interfaces:**
- Consumes: bảng của Task 2; `createEvent`, `admin` trong helpers.
- Produces (SQL): `public.register(p_event uuid, p_name text, p_email text, p_student_id text, p_class text, p_faculty text, p_notice_version text) returns tickets`. Lỗi nghiệp vụ là `raise exception` với message đúng một trong các giá trị `EVENT_NOT_FOUND`, `EVENT_CLOSED`, `EVENT_FULL`, `ALREADY_REGISTERED`. Quyền thực thi: chỉ `service_role`.
- Produces (TS):
  - `type RegisterFailure = 'EVENT_NOT_FOUND' | 'EVENT_CLOSED' | 'EVENT_FULL' | 'ALREADY_REGISTERED' | 'UNKNOWN'`
  - `mapRegisterError(err: { code?: string; message: string }): RegisterFailure`
  - `type RegistrationInput = { name: string; email: string; student_id: string; class_name: string; faculty: string }` (định nghĩa và export ở đây; Task 6 import lại)
  - `registerTicket(input: RegistrationInput & { eventId: string }): Promise<{ ok: true; token: string } | { ok: false; reason: RegisterFailure }>`. Gọi `admin.rpc('register', …)` với `p_notice_version = NOTICE_VERSION`.

Thân hàm (đây là thuật toán quyết định đúng/sai nên viết sẵn):

```sql
create function public.register(p_event uuid, p_name text, p_email text, p_student_id text,
  p_class text, p_faculty text, p_notice_version text)
returns tickets language plpgsql security definer set search_path = public as $$
declare t tickets; e events;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not e.registration_open then raise exception 'EVENT_CLOSED'; end if;
  -- kiểm tra trùng trước bộ đếm: người đã đăng ký không bao giờ nhận "hết chỗ"
  if exists (select 1 from tickets where event_id = p_event
             and (email = lower(p_email) or (p_student_id <> '' and student_id = p_student_id))) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  update events set seats_taken = seats_taken + 1
    where id = p_event and seats_taken < capacity and registration_open;
  if not found then raise exception 'EVENT_FULL'; end if;
  insert into tickets(event_id, name, email, student_id, class_name, faculty, token, short_code,
                      consent_at, notice_version)
    values (p_event, p_name, lower(p_email), p_student_id, p_class, p_faculty,
            encode(extensions.gen_random_bytes(16), 'hex'),
            upper(encode(extensions.gen_random_bytes(4), 'hex')),
            now(), p_notice_version)
    returning * into t;  -- 23505 do đăng ký đồng thời: cả transaction hoàn tác, gồm bộ đếm
  return t;
end $$;
revoke execute on function public.register from public, anon, authenticated;
grant execute on function public.register to service_role;
```

- [ ] **Step 1:** Viết `tests/integration/register.test.ts`:
  - `50 parallel into 10 seats`: `Promise.all` 50 lời gọi `admin.rpc('register')`, mỗi lời gọi một email/MSSV khác. Kỳ vọng đúng 10 kết quả không lỗi, 40 lỗi đều có `message === 'EVENT_FULL'`, `events.seats_taken === 10`, `count(tickets) === 10`.
  - `same email different case`: `a@x.com` rồi `A@X.com` (MSSV khác) → lần 2 lỗi `ALREADY_REGISTERED`, có 1 vé.
  - `same student id`: cùng MSSV, email khác → `ALREADY_REGISTERED`.
  - `duplicate on full event`: sự kiện 1 chỗ, A đăng ký, A gửi lại → `ALREADY_REGISTERED` (không phải `EVENT_FULL`).
  - `parallel duplicates`: 5 lời gọi song song cùng email vào sự kiện 10 chỗ → đúng 1 vé, `seats_taken === 1`.
  - `closed event`: `registration_open=false` → `EVENT_CLOSED`.
  - `token shape`: vé trả về có `token` khớp `^[0-9a-f]{32}$`, `short_code` khớp `^[0-9A-F]{8}$`, `consent_at` khác null.
  - `anon cannot call register`: `anon.rpc('register', …)` trả lỗi.
- [ ] **Step 2:** Viết `tests/unit/register.test.ts` cho `mapRegisterError`:
  - `{message:'EVENT_FULL'}` → `'EVENT_FULL'` (tương tự cho 3 mã còn lại).
  - `{code:'23505', message:'… "tickets_event_email_key"'}` → `'ALREADY_REGISTERED'`; cũng vậy với `tickets_event_student_key`.
  - `{code:'23505', message:'… tickets_event_short_code_key'}` → `'UNKNOWN'`.
  - `{message:'boom'}` → `'UNKNOWN'`.
- [ ] **Step 3:** Chạy cả hai bộ test; FAIL.
- [ ] **Step 4:** Viết migration như trên, rồi viết `lib/register.ts`. Trên `mapRegisterError` đặt comment `// shortcut: short_code collision (~3e-5 at 500 seats) reports UNKNOWN, retry on the form if it ever shows up`.
- [ ] **Step 5:** `npx supabase db reset && npm run test:int && npm test`; tất cả PASS. Chạy bài 50 song song 5 lần liên tiếp, lần nào cũng phải PASS.
- [ ] **Step 6:** Commit `feat(db): transactional register with capacity and duplicate guards`.

---

### Task 4: Đăng nhập Google cho ban tổ chức

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `proxy.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/dashboard/page.tsx`

**Interfaces:**
- Produces: `createClient(): Promise<SupabaseClient>` trong `lib/supabase/server.ts` (cookie-based, `@supabase/ssr`); `admin: SupabaseClient` trong `lib/supabase/admin.ts`; `requireUser(): Promise<User>` trong `lib/supabase/server.ts` (redirect `/login` nếu chưa đăng nhập).

- [ ] **Step 1:** `npm i @supabase/supabase-js @supabase/ssr server-only`. Đọc hướng dẫn chính thức "Supabase Auth with Next.js" bản hiện hành, rồi viết `server.ts` và `proxy.ts` theo đúng hướng dẫn đó. `proxy.ts` chỉ áp cho `/dashboard/:path*`.
- [ ] **Step 2:** `app/login/page.tsx`: nút gọi `signInWithOAuth({ provider: 'google', options: { redirectTo: `${SITE_URL}/auth/callback` } })`. Nếu user agent chứa `Zalo|FBAN|FBAV|Messenger`, hiện khối cảnh báo "Hãy mở trang này bằng Safari hoặc Chrome" kèm nút sao chép link.
- [ ] **Step 3:** `auth/callback/route.ts` gọi `exchangeCodeForSession(code)` rồi redirect `/dashboard`. `dashboard/page.tsx` gọi `requireUser()` rồi liệt kê `events` của user (tạm thời là danh sách rỗng).
- [ ] **Step 4:** Kiểm tra tay với Supabase cục bộ (bật Google trong `config.toml` bằng client OAuth test của bạn): đăng nhập thì tới `/dashboard` và có dòng `profiles`; vào `/dashboard` khi chưa đăng nhập thì bị chuyển về `/login`. Ghi kết quả vào mô tả commit.
- [ ] **Step 5:** `npm run typecheck && npm run lint && npm run build`; PASS. Commit `feat(auth): Google sign-in for organizers`.

---

### Task 5: Tạo sự kiện và trang quản lý

**Files:**
- Create: `lib/validation.ts` (phần `parseEventForm`), `tests/unit/validation.test.ts` (phần event), `app/dashboard/events/new/page.tsx`, `app/dashboard/events/actions.ts`, `app/dashboard/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `createClient`, `requireUser` (Task 4); trigger tạo organizer (Task 2).
- Produces: `parseEventForm(fd: FormData): { ok: true; value: EventInput } | { ok: false; errors: Record<string, string> }` với `EventInput = { club_name: string; title: string; starts_at: string /* ISO, +07:00 */; location: string; capacity: number }`; Server Action `createEvent(prev, fd)`.

- [ ] **Step 1:** Viết test trong `validation.test.ts`:
  - `parses start time as +07:00`: `starts_at="2026-12-05T18:30"` → `new Date(value.starts_at).toISOString() === "2026-12-05T11:30:00.000Z"`.
  - `rejects capacity 0, 5001, "abc"`, chấp nhận `"150"` → `150`.
  - `requires title and club_name` (sau khi trim): thiếu thì `errors.title` có giá trị.
- [ ] **Step 2:** Chạy `npm test`; FAIL. Viết `parseEventForm` bằng TypeScript thuần, không thêm thư viện validation. Chạy lại; PASS.
- [ ] **Step 3:** `npm i qrcode && npm i -D @types/qrcode`. Viết `createEvent`: validate → insert `events` bằng client của user (`owner_id = user.id`) → redirect `/dashboard/events/<id>`. Trang `[id]` hiện link `${SITE_URL}/e/<id>`, ảnh QR của link (dùng `qrcode` như Task 7) để đưa lên poster, `seats_taken / capacity`, và nút đóng/mở đăng ký (Server Action update `registration_open`). Lỗi CHECK khi giảm `capacity` dưới `seats_taken` hiện "Số chỗ không được nhỏ hơn số đã đăng ký".
- [ ] **Step 4:** Kiểm tra tay: tạo sự kiện, mở link `/e/<id>` trong cửa sổ ẩn danh; trang chưa có thì 404 là đúng ở bước này. `npm run build`; PASS.
- [ ] **Step 5:** Commit `feat: organizers create and manage events`.

---

### Task 6: Trang đăng ký công khai + Turnstile

**Files:**
- Create: `lib/turnstile.ts`, `app/e/[id]/page.tsx`, `app/e/[id]/actions.ts`, `app/privacy/page.tsx`, `tests/unit/turnstile.test.ts`
- Modify: `lib/validation.ts` (thêm `parseRegistration`), `tests/unit/validation.test.ts`

**Interfaces:**
- Consumes: `registerTicket` (Task 3), `NOTICE_VERSION` (Task 1).
- Produces:
  - `parseRegistration(fd: FormData): { ok: true; value: RegistrationInput } | { ok: false; errors: Record<string, string> }`
  - `verifyTurnstile(token: string | null, ip: string | null): Promise<boolean>`: POST tới `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
  - Server Action `submitRegistration(eventId, prev, fd)`: thành công thì `redirect('/t/<token>')`; thất bại trả `{ message }`.

Thông báo theo lý do (đúng chữ):
- `EVENT_FULL`: "Sự kiện đã hết chỗ."
- `EVENT_CLOSED` và `EVENT_NOT_FOUND`: "Sự kiện không còn nhận đăng ký."
- `ALREADY_REGISTERED`: "Email hoặc MSSV này đã đăng ký sự kiện. Hãy dùng vé đã nhận."
- `UNKNOWN`: "Có lỗi, bạn thử lại sau ít phút."
- Turnstile thất bại: "Không xác minh được bạn không phải bot, hãy tải lại trang."

- [ ] **Step 1:** Viết test `parseRegistration`:
  - `normalizes email`: `" An@X.com "` → `"an@x.com"`; `"a@b"` bị từ chối.
  - `keeps leading zeros`: `" 0012 345 "` → `"0012345"`; `"ab-12"` bị từ chối (regex `^[A-Z0-9]{4,20}$` sau khi upper-case).
  - `normalizes name to NFC`: `"Nguye\u0302\u0303n"` → `"Nguyễn".normalize("NFC")`; tên 1 ký tự bị từ chối.
  - `requires consent`: không có `consent=on` → `errors.consent === "Bạn cần đồng ý để đăng ký."`.
- [ ] **Step 2:** Viết test `verifyTurnstile(null, …)` → `false` và không gọi `fetch` (dùng `vi.spyOn(globalThis, 'fetch')`).
- [ ] **Step 3:** Chạy `npm test`; FAIL. Viết hai hàm. Chạy lại; PASS.
- [ ] **Step 4:** Trang `/e/[id]`: đọc sự kiện bằng `anon` (RLS chỉ trả sự kiện đang mở; không có thì hiện "Sự kiện không còn nhận đăng ký"). Form gồm 5 trường `required` và ô `consent` không tích sẵn. Nhãn của ô đồng ý dùng mẫu câu trong spec, điền tên CLB, tên sự kiện, "Supabase (Singapore)", 30 ngày; kèm link `/privacy`. Thêm widget Turnstile. `/privacy` hiện nội dung thông báo kèm `NOTICE_VERSION`.
- [ ] **Step 5:** `submitRegistration`: `verifyTurnstile` (IP lấy từ `x-forwarded-for`) → `parseRegistration` → `registerTicket` → redirect hoặc trả thông báo. Không ghi dữ liệu form vào log.
- [ ] **Step 6:** `npm run build`; PASS. Commit `feat: public registration form with consent and Turnstile`.

---

### Task 7: Trang vé QR + E2E trọn luồng đăng ký

**Files:**
- Create: `lib/ticket.ts`, `app/t/[token]/page.tsx`, `tests/unit/ticket.test.ts`, `tests/integration/ticket.test.ts`, `playwright.config.ts`, `e2e/register.spec.ts`
- Modify: `next.config.ts` (headers), `.github/workflows/ci.yml` (thêm bước e2e)

**Interfaces:**
- Produces:
  - `isValidToken(s: string): boolean` (`^[0-9a-f]{32}$`)
  - `ticketUrl(token: string): string` = `${NEXT_PUBLIC_SITE_URL}/t/${token}`
  - `getTicketByToken(token: string): Promise<{ name: string; student_id: string; short_code: string; status: string; event: { title: string; starts_at: string; location: string } } | null>`. Dùng `admin`, chỉ select đúng các cột này, **không trả email**. Token không hợp lệ thì trả `null` mà không truy vấn.

- [ ] **Step 1:** Unit test:
  - `isValidToken`: `"a".repeat(32)` true; chữ hoa, 31 ký tự, `"../x"` đều false.
  - `ticketUrl("ab…")` bắt đầu bằng `NEXT_PUBLIC_SITE_URL + "/t/"`.
- [ ] **Step 2:** Integration test:
  - `getTicketByToken` của vé thật trả đúng `name`, `short_code`, và không có key `email`.
  - Token hợp lệ về hình dạng nhưng không tồn tại → `null`.
- [ ] **Step 3:** Chạy test; FAIL. Viết `lib/ticket.ts`; PASS.
- [ ] **Step 4:** `app/t/[token]/page.tsx` (nhớ `params` là Promise trong Next 16): gọi `getTicketByToken`, nếu `null` thì `notFound()`. Render ảnh từ `QRCode.toDataURL(ticketUrl(token), { errorCorrectionLevel: 'M', margin: 4, width: 320 })` trên nền trắng, kèm mã ngắn, tên, MSSV, thông tin sự kiện, nút "Tải ảnh vé" (`<a download="ve-<short_code>.png">`) và lời nhắc "Chụp màn hình vé và tăng độ sáng khi tới cửa". Trang chỉ đọc. Trong `next.config.ts`, thêm cho `/t/:path*` header `Referrer-Policy: no-referrer` và `X-Robots-Tag: noindex`.
- [ ] **Step 5:** `npm i -D @playwright/test@1.65 && npx playwright install chromium`. Viết `e2e/register.spec.ts`, seed sự kiện bằng `admin` trong `beforeAll`, dùng khóa test của Turnstile (luôn pass; đối chiếu giá trị trên tài liệu Cloudflare):
  - `register shows ticket`: điền form, tích đồng ý, gửi → URL khớp `/t/[0-9a-f]{32}`, thấy `img[alt="Mã QR vé"]` và mã ngắn 8 ký tự.
  - `second registration says already registered`: gửi lại cùng email → thấy "đã đăng ký sự kiện".
  - `unknown token is 404`: `/t/` + `"0".repeat(32)` → status 404.
- [ ] **Step 6:** `npm run build && npm run e2e`; PASS. Thêm vào job `integration` của CI: `npx playwright install --with-deps chromium`, `npm run build`, `npm run e2e`.
- [ ] **Step 7:** Commit `feat: on-screen QR ticket page with e2e registration flow`.

---

### Task 8: Sentry, `/api/health`, triển khai public

**Files:**
- Create: `lib/scrub.ts`, `tests/unit/scrub.test.ts`, `app/api/health/route.ts`; các file cấu hình Sentry do wizard sinh
- Modify: cấu hình Sentry (thêm `beforeSend`)

**Interfaces:**
- Produces: `scrubToken(s: string): string`, thay mọi `/t/[0-9a-f]{32}` bằng `/t/[token]`; `GET /api/health` trả `200 {"ok":true}` khi `admin.from('events').select('id').limit(1)` không lỗi, ngược lại trả `503`.

- [ ] **Step 1:** Test `scrubToken`: `"https://x.vn/t/" + "a".repeat(32) + "?q=1"` → `"https://x.vn/t/[token]?q=1"`; chuỗi không có token giữ nguyên.
- [ ] **Step 2:** FAIL → viết `scrubToken` → PASS.
- [ ] **Step 3:** `npx @sentry/wizard@latest -i nextjs` (đọc lại các file nó sinh, bỏ phần ví dụ). Trong `beforeSend` của cả client lẫn server, áp `scrubToken` lên `event.request.url` và `url` của các breadcrumb. Tắt Session Replay.
- [ ] **Step 4:** Viết `/api/health` với `export const dynamic = 'force-dynamic'`. Chạy `npm run build`; PASS.
- [ ] **Step 5:** Triển khai (hỏi người dùng trước): `npx supabase link` vào project staging rồi `npx supabase db push`; làm lại với production. Đẩy repo lên GitHub, Vercel tự build. Kiểm tra trên URL production:
  - `/api/health` trả 200.
  - Đăng nhập Google được.
  - Tạo sự kiện thử, đăng ký từ điện thoại qua 4G, thấy vé.
  - Sentry nhận một lỗi thử và URL trong lỗi đã bị che token.
- [ ] **Step 6:** Commit `feat: Sentry with token scrubbing and health endpoint`.

---

### Task 9: Bản thử máy quét trên điện thoại thật (giả định rủi ro #2)

**Files:**
- Create: `app/scan-test/page.tsx`, `scripts/copy-zxing-wasm.mjs`, `public/zxing/` (do script tạo, đưa vào `.gitignore`)
- Modify: `package.json` (`"postinstall": "node scripts/copy-zxing-wasm.mjs"`)

**Interfaces:**
- Produces: trang `/scan-test`, chỉ giải mã và hiển thị, **không gọi API nào**. Kế hoạch 2 sẽ dựng máy quét thật dựa trên kết quả trang này.

- [ ] **Step 1:** `npm i barcode-detector`. Đọc README của gói để biết đường dẫn file `.wasm` trong `node_modules` và cách gọi `setZXingModuleOverrides`. Script copy file đó vào `public/zxing/`.
- [ ] **Step 2:** Trang client có nút "Bắt đầu quét" (camera chỉ bật sau lần chạm), `<video playsInline muted autoPlay>`, `facingMode: 'environment'`. Mỗi khung hình gọi `BarcodeDetector.detect`, hiện chuỗi giải mã và số mili-giây từ lúc thấy mã. Bỏ qua chuỗi trùng trong 2,5 giây.
- [ ] **Step 3:** Mở tab Network khi vào trang và xác nhận không có request nào tới `cdn.jsdelivr.net`.
- [ ] **Step 4:** Thử bằng tay trên URL preview của Vercel với **một iPhone (Safari) và một Android tầm trung (Chrome)**: quét vé thật từ màn hình máy khác, dưới đèn phòng và trong phòng tối. Mở thêm link trong Zalo để xem lỗi camera ra sao. Ghi bảng kết quả (máy, trình duyệt, quét được không, thời gian) vào `docs/scan-test-results.md`.
- [ ] **Step 5:** Commit `chore: scanner spike page and device test results`.

---

## Thứ tự và mốc

| Tuần | Task | Xong khi |
|---|---|---|
| 1 | 1, 2, 3, 4 + việc người dùng tự làm | CI xanh; bài 50 song song qua 5/5 lần; đăng nhập Google được |
| 2 | 5, 6, 7, 8, 9 | URL production đăng ký được từ điện thoại; có bảng kết quả quét trên 2 máy thật |

## Kế hoạch tiếp theo (viết sau khi xong kế hoạch này)

- **Kế hoạch 2 — Điểm danh:** hàm `checkin` (một câu `UPDATE` có điều kiện, kiểm tra `event_members`), ghi `checkin_events`, máy quét ba màu, tra tay theo tên/MSSV, link mời người soát vé, test hai lượt điểm danh song song và test sự kiện A/B.
- **Kế hoạch 3 — Sau sự kiện:** xuất `.xlsx` (MSSV dạng text), hủy vé trả chỗ (`cancel_ticket`), lưu số tổng hợp (có mặt, trung vị thời gian quét) **trước** khi xóa, nút xóa dữ liệu, tự xóa theo `purge_after`, runbook ngày sự kiện.
