# Điểm danh QR — Kế hoạch 2: Điểm danh (tuần 3–4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ban tổ chức mời người soát vé bằng link. Người soát vé quét QR bằng trình duyệt điện thoại và thấy ngay một trong ba màu: xanh (vào), đỏ (đã vào / không hợp lệ), vàng (đang chờ mạng). Người quên vé được tìm theo tên hoặc MSSV. Ban tổ chức xem danh sách và số đã vào gần như trực tiếp. Không vé nào được điểm danh hai lần.

**Architecture:** Mọi quy tắc nằm trong Postgres, giống Kế hoạch 1. Hàm `checkin` (security definer) kiểm tra người gọi có trong `event_members`, rồi chạy một câu `UPDATE … WHERE checked_in_at IS NULL`, ghi nhật ký vào `checkin_events` và trả kết quả dạng liệt kê. Lời mời là bảng `event_invites` cùng ba hàm RPC. Trình duyệt gọi Server Action. Server Action gọi RPC bằng client có phiên của người dùng (không dùng service-role), nên RLS và kiểm tra thành viên luôn có hiệu lực. Máy quét dùng lại bộ giải mã zxing tự host của `/scan-test`. Khi mất mạng, lượt quét được giữ trong `localStorage` với `scan_id` duy nhất, nên gửi lại bao nhiêu lần cũng không bị tính trùng.

**Tech Stack:** Như Kế hoạch 1: Next.js 16.4.6, `@supabase/ssr` 0.12, Supabase Postgres 17, `barcode-detector` (ponyfill zxing), Vitest 5, Playwright 1.65.

**Spec:** `C:\Users\cungt\Downloads\MVP web điểm danh QR.md`, cộng mục "Sửa đổi so với spec" của Kế hoạch 1 (`docs/superpowers/plans/2026-11-12-diem-danh-qr-nen-mong-dang-ky.md`) và mục dưới đây. Khi mâu thuẫn, các mục sửa đổi thắng spec.

## Sửa đổi so với spec (thêm cho kế hoạch này)

1. **Link mời người soát vé:** hết hạn sau **7 ngày**. Mỗi sự kiện chỉ có **một link đang hiệu lực**: tạo link mới thì link cũ bị thu hồi. Ban tổ chức có thể thu hồi link và gỡ từng người soát vé.
2. **Nhận lời mời bằng POST:** mở link (GET) chỉ hiện trang "Nhận vai trò soát vé", bấm nút mới thêm quyền. Điều này giữ quy tắc "không GET nào thay đổi dữ liệu", vì Zalo/Messenger tự mở link để xem trước.
3. **Vé của sự kiện khác** trả `wrong_event` và **không** trả tên/MSSV, để người soát vé sự kiện A không đọc được dữ liệu sự kiện B.
4. **Giờ điểm danh của lượt quét chờ mạng** là giờ quét trên máy, nhưng bị kẹp vào khoảng `[now() - 1 ngày, now()]` ở máy chủ.
5. **Người soát vé không thấy email** của sinh viên: mọi truy vấn phía người soát vé chỉ chọn cột họ tên, MSSV, lớp, khoa, giờ điểm danh.
6. **Trang "trực tiếp"** là trang danh sách tự tải lại sau mỗi 15 giây. Không dùng Supabase Realtime (Kế hoạch 1 đã tắt `realtime` trong CI).
7. **Tên người quét** lấy theo thứ tự: `profiles.display_name`, rồi `full_name` hoặc `name` trong metadata Google, rồi phần trước `@` của email.

## Global Constraints

- Toàn bộ Global Constraints của Kế hoạch 1 vẫn áp dụng, gồm: token `^[0-9a-f]{32}$`, không GET nào thay đổi dữ liệu, service-role chỉ import trong `lib/supabase/admin.ts`, giao diện tiếng Việt và code tiếng Anh, không dòng ghi công AI trong commit, hỏi trước mỗi commit/push, test chỉ chạy trên Supabase cục bộ.
- Kết quả điểm danh có đúng 5 giá trị: `ok`, `already`, `not_found`, `wrong_event`, `cancelled`. Phương thức có 2 giá trị: `qr`, `manual`.
- Lỗi phân quyền của RPC dùng `raise exception 'NOT_MEMBER' using errcode = '42501'`. Lời mời sai, hết hạn hoặc đã thu hồi dùng message `INVITE_INVALID`.
- Màu nền máy quét: xanh `#0d7a5c` (brand), đỏ `#b42318`, vàng `#b54708`. Kết quả xanh/đỏ giữ trên màn hình **2 giây**. Cùng một chuỗi giải mã được bỏ qua trong **2,5 giây**.
- Không trả lỗi 500 cho lượt quét trùng: mọi kết quả nghiệp vụ là giá trị trả về, không phải exception.
- Mọi hàm `security definer` đều có `set search_path = public`. Mọi hàm mới đều `revoke execute … from public, anon` và chỉ `grant execute … to authenticated`.
- Migration mới được người dùng tự chạy lên staging và prod bằng `npx supabase db push --remote` (xem `docs/huong-dan-cau-hinh.md`).

## Review Focus

1. **Gửi lại cùng một `scan_id`** (máy quét thử lại sau khi rớt mạng, nhưng lần đầu thực ra đã thành công) → phải trả lại đúng kết quả `ok` của lần đầu, không được thành `already`. Test: `checkin.test.ts › replaying a scan_id returns the original result`.
2. **Hai máy quét cùng một vé cùng lúc** → đúng một `ok`, máy kia nhận `already` kèm giờ và tên người quét đầu. Test: `checkin.test.ts › parallel checkins: exactly one ok`.
3. **QR không phải của web này** (mã sản phẩm, link lạ, link `/t/<token>` của domain khác) → báo "không hợp lệ" ngay trên máy, không gọi máy chủ. Test: `checkin-parse.test.ts › rejects foreign hosts and non-ticket codes`.
4. **Tìm tên có ký tự `%` hoặc `_`, hoặc gõ không dấu / khác hoa thường** → không lộ toàn bộ danh sách qua wildcard. Tìm "nguyen" phải ra "Nguyễn". Test: `checkin-parse.test.ts › escapes LIKE wildcards` + `checkin.test.ts › search matches unaccented name`.
5. **Người đã có vai trò ban tổ chức mở link mời soát vé** → vẫn là ban tổ chức, không bị hạ quyền. Test: `invites.test.ts › organizer is not downgraded by accepting`.

---

## Cấu trúc file

```
supabase/migrations/
  20261116000100_checkin.sql        # unaccent, FK ghép, user_display_name, checkin, search_tickets
  20261116000200_invites.sql        # event_invites, create/revoke/accept invite, invite_preview, remove_checker, member_names
lib/
  checkin.ts                        # parseTicketToken, CheckinOutcome, mapCheckinRow
  scan-queue.ts                     # hàng đợi lượt quét chờ mạng (thuần + bọc localStorage)
  safe-next.ts                      # safeNext(): chỉ cho đường dẫn tương đối cùng origin
components/
  use-qr-scanner.ts                 # hook camera + zxing (tách từ app/scan-test/scan-test.tsx)
app/
  invite/[token]/page.tsx           # trang nhận lời mời (GET chỉ hiển thị)
  invite/[token]/actions.ts         # acceptInvite (POST)
  dashboard/events/[id]/page.tsx    # sửa: lọc theo thành viên, giao diện theo vai trò, khối mời
  dashboard/events/[id]/invites.tsx # tạo/sao chép/thu hồi link, danh sách người soát vé
  dashboard/events/[id]/invite-actions.ts
  dashboard/events/[id]/scan/page.tsx      # máy quét
  dashboard/events/[id]/scan/scanner.tsx   # client: camera, ba màu, tìm kiếm, hàng đợi
  dashboard/events/[id]/scan/actions.ts    # checkIn, searchTickets (Server Actions)
  dashboard/events/[id]/attendees/page.tsx # danh sách + số đã vào, tự tải lại 15 giây
  login/page.tsx, auth/callback/route.ts, proxy.ts  # sửa: tham số next, cookie khi redirect
tests/integration/checkin.test.ts, tests/integration/invites.test.ts
tests/unit/checkin-parse.test.ts, tests/unit/scan-queue.test.ts, tests/unit/safe-next.test.ts
e2e/auth.ts                         # đăng nhập bằng mật khẩu trên Supabase cục bộ, gắn cookie vào trình duyệt
e2e/checkin.spec.ts
```

---

### Task 1: Hàm `checkin` và tìm vé trong Postgres

**Files:**
- Create: `supabase/migrations/20261116000100_checkin.sql`, `tests/integration/checkin.test.ts`
- Modify: `tests/integration/helpers.ts` (thêm `addMember`, `registerTicket`)

**Interfaces:**
- Consumes: bảng `tickets`, `checkin_events`, `event_members`, hàm `is_event_member` (Kế hoạch 1, Task 2), `register` (Task 3).
- Produces (SQL):
  - `public.user_display_name(p_user uuid) returns text`, theo sửa đổi 7. Là `security definer`, **không** grant cho `authenticated`, chỉ dùng bên trong hàm khác.
  - `public.checkin(p_event uuid, p_scan_id uuid, p_token text default null, p_ticket uuid default null, p_scanned_at timestamptz default null) returns jsonb`. Đối tượng trả về có khóa: `result`, `ticket_id`, `name`, `student_id`, `class_name`, `checked_in_at`, `checked_in_by_name`.
    - Với `not_found` và `wrong_event`, mọi khóa trừ `result` là `null`.
    - Với `cancelled`, chỉ có `result`, `name` và `student_id`.
    - `method` = `qr` nếu có `p_token`, `manual` nếu có `p_ticket`. Có cả hai hoặc không có cái nào thì raise `BAD_REQUEST`.
  - `public.search_tickets(p_event uuid, p_query text) returns table(id uuid, name text, student_id text, class_name text, faculty text, checked_in_at timestamptz)`, tối đa 20 dòng, sắp theo `name`. Hàm kiểm tra thành viên giống `checkin`, so khớp `unaccent(lower(name)) like '%' || unaccent(lower(q)) || '%'` hoặc `student_id like q || '%'`. Wildcard trong `q` được escape **trong SQL** bằng `replace` cho `\`, `%`, `_`. `p_query` sau khi trim mà ngắn hơn 2 ký tự thì trả rỗng.
  - FK ghép: thêm `unique (id, event_id)` trên `tickets`. `checkin_events` đổi sang `foreign key (ticket_id, event_id) references tickets (id, event_id) on delete set null (ticket_id)`, thay FK đơn cũ.
  - `create extension if not exists unaccent with schema extensions`. Gọi bằng `extensions.unaccent(…)`.
- Produces (TS, helpers): `addMember(eventId: string, userId: string, role: 'organizer'|'checker'): Promise<void>` và `registerTicket(eventId: string, over?: Partial<{name:string; email:string; student_id:string}>): Promise<{ id: string; token: string }>`. Hàm sau gọi `admin.rpc('register', …)`.

Thân `checkin`. Đây là thuật toán quyết định đúng/sai nên viết sẵn, phần trả `jsonb` để implementer tự viết:

```sql
-- 1. if not is_event_member(p_event,'{organizer,checker}') then raise exception 'NOT_MEMBER' using errcode='42501';
-- 2. if (p_token is null) = (p_ticket is null) then raise exception 'BAD_REQUEST';
-- 3. Replay: if exists checkin_events where scan_id = p_scan_id → trả lại kết quả đã lưu
--    (result lưu trong dòng; dữ liệu vé đọc lại từ tickets theo ticket_id nếu result in ('ok','already','cancelled')).
-- 4. ts := least(now(), greatest(coalesce(p_scanned_at, now()), now() - interval '1 day'));
-- 5. update tickets set checked_in_at = ts, checked_in_by = auth.uid()
--      where event_id = p_event and (token = p_token or id = p_ticket)
--        and checked_in_at is null and status = 'valid'
--      returning … → result 'ok'
-- 6. Không có dòng: tra vé theo token/id ở mọi sự kiện:
--      không thấy → 'not_found'; event_id <> p_event → 'wrong_event' (ticket_id ghi null);
--      status = 'cancelled' → 'cancelled'; còn lại → 'already' (kèm checked_in_at, user_display_name(checked_in_by)).
-- 7. insert into checkin_events(event_id, scan_id, ticket_id, checker_id, result, method, scanned_at)
--      values (…, ts) on conflict (scan_id) do nothing;
--    nếu không chèn được (một lần gửi lại song song đã chèn trước) → làm lại bước 3 và trả kết quả đó.
```

- [ ] **Step 1: Viết test thất bại** trong `tests/integration/checkin.test.ts`. Mỗi test tạo sự kiện riêng bằng `createEvent` + `addMember`:
  - `ok then already`: lần 1 trả `result: 'ok'`, `name` khớp; lần 2 (scan_id mới) trả `already`, `checked_in_by_name` khác null.
  - `parallel checkins: exactly one ok`: 2 lời gọi `Promise.all` từ 2 checker khác nhau, cùng token → đếm đúng 1 `ok` và 1 `already`; `checkin_events` có 2 dòng.
  - `replaying a scan_id returns the original result`: gọi 2 lần cùng `p_scan_id` → cả hai trả `ok`; `checkin_events` có 1 dòng.
  - `wrong event hides data`: vé của sự kiện B quét ở sự kiện A (checker của A) → `{ result: 'wrong_event', name: null, student_id: null, ticket_id: null }`.
  - `cancelled`: `admin` đặt `status='cancelled'` → `cancelled`, `checked_in_at` của vé vẫn null.
  - `not found`: token ngẫu nhiên 32 hex → `not_found`.
  - `manual by ticket id`: `p_ticket` → `ok`, dòng nhật ký có `method = 'manual'`.
  - `non-member is refused`: checker của A gọi cho sự kiện B → lỗi `code: '42501'`. `anon.rpc('checkin', …)` → lỗi, vé không đổi.
  - `scanned_at clamped`: `p_scanned_at` 3 ngày trước → `checked_in_at` ≥ `now() - 1 day - 5s`.
  - `composite FK`: `admin` chèn `checkin_events` với `ticket_id` của sự kiện B và `event_id` của A → lỗi `23503`.
  - `search matches unaccented name`: vé tên "Nguyễn Văn An", tìm `"nguyen"` → 1 dòng. Tìm `"%"` → 0 dòng. Tìm theo 3 ký tự đầu MSSV → có dòng. Kết quả không có cột `email`.
  - `checker cannot update tickets directly`: `checker.client.from('tickets').update({checked_in_at: …})` → 0 dòng bị đổi.
- [ ] **Step 2:** `npx supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,realtime,supavisor,mailpit,postgres-meta`, rồi `npx supabase db reset`, rồi `npm run test:int -- checkin`. Kỳ vọng: FAIL (hàm `checkin` chưa có).
- [ ] **Step 3:** Viết migration `20261116000100_checkin.sql` theo Interfaces và thân hàm ở trên.
- [ ] **Step 4:** `npx supabase db reset && npm run test:int`. Kỳ vọng: mọi test qua, kể cả test cũ của Kế hoạch 1. Sau đó chạy `npx supabase stop`.
- [ ] **Step 5:** Commit `feat(db): checkin and search_tickets functions with composite FK`.

---

### Task 2: Lời mời người soát vé trong Postgres

**Files:**
- Create: `supabase/migrations/20261116000200_invites.sql`, `tests/integration/invites.test.ts`

**Interfaces:**
- Consumes: `user_display_name` (Task 1), `is_event_member`.
- Produces (SQL):
  - Bảng `public.event_invites(token text primary key check (token ~ '^[0-9a-f]{32}$'), event_id uuid not null references events on delete cascade, created_by uuid not null references auth.users, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '7 days', revoked_at timestamptz)`. Bật RLS. Policy select cho `authenticated` khi `is_event_member(event_id,'{organizer}')`. Thu hồi insert/update/delete của `anon` và `authenticated`.
  - `public.create_checker_invite(p_event uuid) returns text`: chỉ organizer, nếu không thì `NOT_MEMBER` 42501. Đặt `revoked_at = now()` cho mọi link còn hiệu lực của sự kiện, rồi chèn token mới `encode(extensions.gen_random_bytes(16),'hex')` và trả token đó.
  - `public.revoke_checker_invites(p_event uuid) returns void`: chỉ organizer.
  - `public.accept_checker_invite(p_token text) returns uuid` (event_id): yêu cầu `auth.uid()` khác null. Link phải tồn tại, `revoked_at is null` và `expires_at > now()`, nếu không thì raise `INVITE_INVALID`. Sau đó `insert into event_members … 'checker' on conflict (event_id, user_id) do nothing`.
  - `public.remove_checker(p_event uuid, p_user uuid) returns void`: chỉ organizer, xóa dòng `role = 'checker'`. Không xóa được organizer.
  - `public.member_names(p_event uuid) returns table(user_id uuid, role text, name text)`: chỉ thành viên (organizer hoặc checker) gọi được, `name = user_display_name(user_id)`.
  - `public.invite_preview(p_token text) returns table(club_name text, title text)`: chỉ cho `authenticated`, trả rỗng khi link không hợp lệ, đã thu hồi hoặc hết hạn.

- [ ] **Step 1: Viết test thất bại** `tests/integration/invites.test.ts`:
  - `organizer creates, user accepts`: token khớp `^[0-9a-f]{32}$`; người dùng B gọi `accept_checker_invite` → trả `event_id`; `event_members` có `(B,'checker')`; B gọi `checkin` thành công (dùng `registerTicket`).
  - `new invite revokes old`: tạo 2 lần → token đầu bị `INVITE_INVALID`, token sau vẫn dùng được.
  - `expired invite`: `admin` đặt `expires_at = now() - 1s` → `INVITE_INVALID`.
  - `revoked invite`: sau `revoke_checker_invites` → `INVITE_INVALID`.
  - `organizer is not downgraded by accepting`: owner chấp nhận link của chính mình → vẫn là `organizer`.
  - `checker cannot create invites or see them`: checker gọi `create_checker_invite` → 42501; `select` trên `event_invites` → 0 dòng.
  - `remove_checker`: organizer gỡ B → B gọi `checkin` → 42501. Gọi `remove_checker` với owner_id → owner vẫn còn.
  - `member_names`: trả cả organizer và checker; người ngoài gọi → 42501.
  - `anon cannot accept`: `anon.rpc('accept_checker_invite')` → lỗi.
  - `invite_preview`: link hợp lệ trả 1 dòng (club_name, title). Link đã thu hồi trả 0 dòng.
- [ ] **Step 2:** `npx supabase db reset && npm run test:int -- invites`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Viết migration theo Interfaces.
- [ ] **Step 4:** `npx supabase db reset && npm run test:int`. Kỳ vọng: tất cả qua. Sau đó `npx supabase stop`.
- [ ] **Step 5:** Commit `feat(db): checker invites, member names`.

---

### Task 3: Luồng mời người soát vé trên web

**Files:**
- Create: `lib/safe-next.ts`, `tests/unit/safe-next.test.ts`, `app/invite/[token]/page.tsx`, `app/invite/[token]/actions.ts`, `app/dashboard/events/[id]/invites.tsx`, `app/dashboard/events/[id]/invite-actions.ts`
- Modify: `proxy.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/dashboard/events/[id]/page.tsx`, `app/dashboard/page.tsx`, `docs/huong-dan-cau-hinh.md`

**Interfaces:**
- Consumes: RPC của Task 2; `createClient`, `requireUser` (`lib/supabase/server.ts`); `isValidToken` (`lib/ticket.ts`) để kiểm dạng token mời (cùng định dạng 32 hex).
- Produces:
  - `safeNext(raw: string | null): string`: trả `raw` nếu nó bắt đầu bằng `/`, không bắt đầu bằng `//` hoặc `/\`, và không chứa `\r`, `\n`. Nếu không thì trả `/dashboard`.
  - **Login:**
    - `/login?next=<path>` truyền `next` vào `redirectTo: ${SITE_URL}/auth/callback?next=<encodeURIComponent(path)>`.
    - Callback redirect tới `${origin}${safeNext(next)}` khi thành công. Đường lỗi giữ nguyên `/login?error=1`.
  - **Proxy:**
    - `config.matcher = ["/dashboard/:path*", "/invite/:path*"]`.
    - Khi chưa đăng nhập: redirect `/login?next=<pathname>`.
    - Khi redirect, chép mọi cookie của `response` (cookie đã refresh) sang response redirect. Đây là minor đã hoãn từ Kế hoạch 1.
  - **Trang nhận lời mời:**
    - `app/invite/[token]/page.tsx` chỉ hiển thị (GET): tên CLB và tên sự kiện (tra qua RPC `invite_preview`, xem dưới), cùng nút "Nhận vai trò soát vé".
    - Token sai dạng hoặc lời mời không hợp lệ: hiện "Link mời không còn hiệu lực. Hãy xin ban tổ chức link mới."
  - `acceptInvite(token: string): Promise<{ error: string } | never>` (Server Action): gọi `accept_checker_invite`, thành công thì `redirect('/dashboard/events/<event_id>/scan')`.
  - **Trang quản lý `/dashboard/events/[id]`:**
    - Query lọc theo `event_members!inner(user_id, role)` với `user_id = user.id`. Không phải thành viên thì `notFound()`.
    - **Organizer:** thấy mọi thứ cũ, thêm khối `<Invites>` (tạo link, sao chép, thu hồi, danh sách người soát vé kèm nút "Gỡ"). Thêm 2 nút "Mở máy quét" và "Danh sách điểm danh".
    - **Checker:** chỉ thấy tên sự kiện, thời gian, 2 nút "Mở máy quét" và "Danh sách điểm danh". Không thấy công tắc, số chỗ, link đăng ký, lời mời.
  - **Dashboard `/dashboard`:** thẻ sự kiện mà người dùng là checker có nhãn "Soát vé".
  - `invite-actions.ts`: `createInvite(eventId)`, `revokeInvites(eventId)`, `removeChecker(eventId, userId)`. Mỗi hàm `revalidatePath` trang quản lý. Link mời là `${NEXT_PUBLIC_SITE_URL}/invite/<token>`.

- [ ] **Step 1: Test thất bại** `tests/unit/safe-next.test.ts`:
  - `"/invite/abc"` giữ nguyên.
  - `null`, `"https://evil.com"`, `"//evil.com"`, `"/\\evil.com"`, `"/a\nb"` → `"/dashboard"`.
- [ ] **Step 2:** `npm test -- safe-next`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Cài `safeNext`, sửa login, callback, proxy, trang mời, trang quản lý, dashboard, khối Invites. Dùng `components/ui.tsx` (`Card`, `Button`, `buttonClass`) và lại logic sao chép có fallback của `ShareActions`.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run build`. Kỳ vọng: qua hết.
- [ ] **Step 5:** Thêm vào `docs/huong-dan-cau-hinh.md` mục "Mời người soát vé": tạo link, gửi qua Zalo, **dặn người soát vé mở bằng Safari/Chrome**, đăng nhập Google, bấm nhận.
- [ ] **Step 6:** Commit `feat: checker invite links, role-aware event page, login next param`.

---

### Task 4: Server Action điểm danh và tìm kiếm

**Files:**
- Create: `lib/checkin.ts`, `tests/unit/checkin-parse.test.ts`, `app/dashboard/events/[id]/scan/actions.ts`

**Interfaces:**
- Consumes: RPC `checkin`, `search_tickets` (Task 1); `isValidToken`.
- Produces (`lib/checkin.ts`, không import gì của máy chủ, dùng được ở client):
  - `parseTicketToken(raw: string, siteUrl: string): string | null`: trả token nếu `raw` là URL có origin **trùng** `new URL(siteUrl).origin` và pathname khớp `^/t/([0-9a-f]{32})$`. Trường hợp khác trả `null`. Không throw với chuỗi rác.
  - `type CheckinOutcome =`
    - `{ kind: 'ok'; name: string; studentId: string | null; checkedInAt: string }`
    - `{ kind: 'already'; name: string; studentId: string | null; checkedInAt: string; by: string }`
    - `{ kind: 'invalid'; reason: 'not_found' | 'wrong_event' | 'cancelled' | 'bad_qr' }`
    - `{ kind: 'forbidden' }`
  - `mapCheckinRow(row: Record<string, unknown>): CheckinOutcome`: chuyển `jsonb` của RPC sang dạng trên.
  - `escapeLike` **không** cần, vì việc escape nằm trong SQL (Task 1).
- Produces (`scan/actions.ts`, `"use server"`):
  - `checkIn(input: { eventId: string; scanId: string; token?: string; ticketId?: string; scannedAt?: string }): Promise<CheckinOutcome>`.
    - Kiểm UUID cho `eventId`, `scanId`, `ticketId` và `isValidToken(token)`. Sai thì trả `{kind:'invalid', reason:'bad_qr'}`.
    - Lỗi `42501` → `{kind:'forbidden'}`.
    - Lỗi khác thì **throw**. Phía client coi throw là lỗi mạng hoặc máy chủ và đưa lượt quét vào hàng đợi (Task 6).
  - `searchTickets(eventId: string, q: string): Promise<Array<{ id: string; name: string; studentId: string | null; className: string | null; faculty: string | null; checkedInAt: string | null }>>`.

- [ ] **Step 1: Test thất bại** `tests/unit/checkin-parse.test.ts`. Dùng `SITE = "https://diem-danh-qr-gamma.vercel.app"` và `T = "a".repeat(32)`.
  - `parseTicketToken(\`${SITE}/t/${T}\`, SITE)` → `T`.
  - `rejects foreign hosts and non-ticket codes`: các chuỗi `https://evil.com/t/${T}`, `${SITE}/t/${T.toUpperCase()}`, `${SITE}/t/${T}x`, `${SITE}/e/${T}`, `"8935049501234"` (mã vạch sản phẩm), `""`, `"not a url"` đều trả `null`.
  - Có query hoặc hash (`${SITE}/t/${T}?a=1`) → vẫn trả `T`.
  - `mapCheckinRow({result:'ok', name:'An', student_id:'1', checked_in_at:'2026-…'})` → `{kind:'ok', name:'An', studentId:'1', checkedInAt:'2026-…'}`.
  - `mapCheckinRow({result:'already', …, checked_in_by_name:'Bình'})` → `kind 'already'`, `by: 'Bình'`.
  - `mapCheckinRow` với `not_found`, `wrong_event`, `cancelled` → `{kind:'invalid', reason: …}` tương ứng.
- [ ] **Step 2:** `npm test -- checkin-parse`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Cài `lib/checkin.ts` và `scan/actions.ts` theo Interfaces. Gọi RPC bằng `createClient()` (phiên người dùng), **không** dùng `admin`.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test`. Kỳ vọng: qua.
- [ ] **Step 5:** Commit `feat: check-in and search server actions`.

---

### Task 5: Trang máy quét (online)

**Files:**
- Create: `components/use-qr-scanner.ts`, `app/dashboard/events/[id]/scan/page.tsx`, `app/dashboard/events/[id]/scan/scanner.tsx`
- Modify: `app/scan-test/scan-test.tsx` (dùng lại hook mới, hành vi không đổi)

**Interfaces:**
- Consumes: `checkIn`, `searchTickets` (Task 4); `parseTicketToken`, `CheckinOutcome`; zxing tự host `/zxing/zxing_reader.wasm` và `prepareZXingModule` như trong `scan-test.tsx` hiện tại.
- Produces:
  - `useQrScanner(onCode: (raw: string) => void): { videoRef: RefObject<HTMLVideoElement>; running: boolean; error: string | null; start(): Promise<void>; stop(): void }`.
    - Tách nguyên logic camera, chống trùng 2,5 giây, kiểm tra lượt chạy cũ và thông báo lỗi tiếng Việt từ `scan-test.tsx`.
    - Riêng phần chống trùng: tính theo **lần cuối nhìn thấy**, tức là giữ mã trước camera thì không bắn lại. Đây là minor #5 đã hoãn của Task 9.
  - `page.tsx`:
    - Server component. Kiểm tra người dùng là organizer hoặc checker của sự kiện, nếu không thì `notFound()`.
    - Truyền `eventId`, tên sự kiện, `siteUrl = process.env.NEXT_PUBLIC_SITE_URL` cho `<Scanner>`.
  - `scanner.tsx` (client), thứ tự xử lý một mã:
    1. `parseTicketToken`, `null` → đỏ "Mã không hợp lệ" (không gọi máy chủ).
    2. `scanId = crypto.randomUUID()`.
    3. `await checkIn({ eventId, scanId, token, scannedAt: new Date().toISOString() })`.
    4. Tô màu theo kết quả:
       - `ok` → xanh, hiện họ tên to, MSSV, chữ "Mời vào".
       - `already` → đỏ, hiện "Đã điểm danh lúc HH:MM bởi <by>", kèm họ tên và MSSV.
       - `invalid` → đỏ, với chữ theo lý do: `not_found`/`bad_qr` → "Vé không hợp lệ"; `wrong_event` → "Vé của sự kiện khác"; `cancelled` → "Vé đã bị hủy".
       - `forbidden` → đỏ, hiện "Bạn không còn quyền soát vé sự kiện này".
       - Throw → xử lý ở Task 6. Ở task này, tạm hiện vàng "Mất kết nối, thử lại".
    5. Kết quả giữ **2 giây**, rồi quay về khung quét.
  - **Nút "Tìm theo tên/MSSV"** luôn hiện cạnh khung quét.
    - Mở ô tìm kiếm có debounce 300 ms, gọi `searchTickets`.
    - Mỗi dòng có nút "Điểm danh", gọi `checkIn({ eventId, scanId, ticketId })` và hiện kết quả giống quét.
  - **Lịch sử:** 10 lượt gần nhất (giờ, tên, kết quả).
  - **Ngữ cảnh mở:** trang có dòng nhắc "Mở bằng Safari/Chrome, không mở trong Zalo". Khi `getUserMedia` không có, hiện thông báo sẵn có của hook.

- [ ] **Step 1:** Tách hook. Chạy `npm run build`, rồi mở `/scan-test` bằng `next start` và xác nhận bấm "Bắt đầu quét" vẫn hiện lỗi camera tiếng Việt như trước (trình duyệt trong app bị chặn camera).
- [ ] **Step 2:** Viết `page.tsx` và `scanner.tsx`.
- [ ] **Step 3:** `npm run lint && npm run typecheck && npm test && npm run build`. Kỳ vọng: qua hết.
- [ ] **Step 4:** Kiểm tra tay trên máy tính bằng Supabase cục bộ (camera không cần): mở trang quét, dùng ô tìm kiếm để điểm danh một vé, rồi điểm danh lại vé đó → thấy đỏ "Đã điểm danh lúc …".
- [ ] **Step 5:** Commit `feat: scanner page with three-state result and manual lookup`.

---

### Task 6: Hàng đợi khi rớt mạng (cắt đầu tiên nếu trễ)

**Files:**
- Create: `lib/scan-queue.ts`, `tests/unit/scan-queue.test.ts`
- Modify: `app/dashboard/events/[id]/scan/scanner.tsx`

**Interfaces:**
- Consumes: `checkIn` (Task 4).
- Produces (`lib/scan-queue.ts`):
  - `type QueuedScan = { scanId: string; eventId: string; token?: string; ticketId?: string; scannedAt: string }`
  - `enqueue(list: QueuedScan[], s: QueuedScan): QueuedScan[]`: bỏ qua nếu `scanId` đã có.
  - `remove(list: QueuedScan[], scanId: string): QueuedScan[]`
  - `loadQueue(eventId: string): QueuedScan[]` và `saveQueue(eventId: string, list: QueuedScan[]): void`, với khóa `scan-queue:<eventId>` trong `localStorage`. Bọc `try/catch`: lỗi đọc thì trả `[]`, lỗi ghi thì bỏ qua.
  - `flushQueue(list: QueuedScan[], send: (s: QueuedScan) => Promise<unknown>): Promise<{ sent: string[]; failed: string[] }>`: gửi lần lượt theo thứ tự cũ trước. Gặp lượt đầu tiên bị throw thì dừng, các lượt còn lại tính là `failed`.
- **Hành vi trong `scanner.tsx`:**
  - Khi `checkIn` throw: `enqueue`, `saveQueue`, hiện nền vàng **"Đã lưu, đang chờ mạng"** trong 2 giây, kèm họ tên nếu biết (thường là không), rồi quay về khung quét.
  - Huy hiệu vàng "Đang chờ (n)" luôn hiện khi `n > 0`.
  - `flushQueue` chạy khi có sự kiện `online`, mỗi 10 giây khi `n > 0`, và khi mở trang.
  - Mỗi lượt gửi được thì ghi kết quả vào lịch sử. Lượt nào ra `already` thì lịch sử ghi rõ.
  - Đóng trang khi còn hàng đợi: dùng `beforeunload` để hiện cảnh báo của trình duyệt.

- [ ] **Step 1: Test thất bại** `tests/unit/scan-queue.test.ts`:
  - `enqueue` cùng `scanId` 2 lần → độ dài 1.
  - `flushQueue` với `send` throw ở phần tử thứ 2 trong 3 → `sent=[s1]`, `failed=[s2,s3]`, và `send` chỉ được gọi 2 lần.
  - `loadQueue` khi `localStorage.getItem` throw → `[]`. Dùng `vi.stubGlobal('localStorage', …)`.
- [ ] **Step 2:** `npm test -- scan-queue`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Cài `lib/scan-queue.ts` và nối vào `scanner.tsx`.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run build`. Kỳ vọng: qua.
- [ ] **Step 5:** Kiểm tra tay bằng Supabase cục bộ: mở trang quét, DevTools → Network → Offline, điểm danh qua tìm kiếm → nền vàng và "Đang chờ (1)". Bật lại Online → sau tối đa 10 giây huy hiệu biến mất và lịch sử ghi "Mời vào". Bật Offline lần nữa, điểm danh cùng vé, bật Online → lịch sử ghi "Đã điểm danh", không phải lỗi.
- [ ] **Step 6:** Commit `feat: offline scan queue with idempotent replay`.

---

### Task 7: Danh sách điểm danh, số đã vào, và E2E trọn luồng

**Files:**
- Create: `app/dashboard/events/[id]/attendees/page.tsx`, `app/dashboard/events/[id]/attendees/auto-refresh.tsx`, `e2e/auth.ts`, `e2e/checkin.spec.ts`

**Interfaces:**
- Consumes: `member_names` (Task 2); bảng `tickets` qua RLS (thành viên đọc được).
- Produces:
  - **Trang danh sách**, chỉ cho organizer hoặc checker:
    - Đầu trang: "Đã vào **X** / **Y** đã đăng ký", với Y là số vé `status = 'valid'`.
    - Bảng gồm họ tên, MSSV, lớp, khoa, giờ điểm danh (HH:MM, giờ VN), người quét (từ `member_names`). Người đã vào xếp trước, mới nhất trước. Người chưa vào xếp sau, theo tên.
    - **Không** chọn cột `email`.
    - Trên điện thoại, bảng chuyển thành danh sách thẻ (không cuộn ngang).
  - `AutoRefresh({ seconds: 15 })` (client): gọi `router.refresh()` mỗi 15 giây khi tab đang hiện (`document.visibilityState === 'visible'`).
  - `signInAs(context: BrowserContext, email: string, password: string): Promise<void>` trong `e2e/auth.ts`:
    - Tạo `createServerClient` của `@supabase/ssr` với kho cookie trong bộ nhớ, rồi `signInWithPassword`.
    - Gọi `context.addCookies` với các cookie thu được, `domain: 'localhost'`, `path: '/'`.
    - Chặn URL không phải localhost giống `register.spec.ts`.

- [ ] **Step 1: Viết E2E thất bại** `e2e/checkin.spec.ts`. `beforeAll` tạo organizer bằng `admin.auth.admin.createUser` với mật khẩu, tạo sự kiện và một vé qua `admin.rpc('register', …)`. Kịch bản:
  1. `signInAs` bằng tài khoản organizer.
  2. Mở `/dashboard/events/<id>/attendees` → thấy tên vé và "Đã vào 0 / 1".
  3. Mở `/dashboard/events/<id>/scan`, bấm "Tìm theo tên/MSSV", gõ 3 ký tự đầu MSSV, bấm "Điểm danh" → thấy "Mời vào".
  4. Đợi 2 giây, tìm lại, bấm "Điểm danh" lần nữa → thấy chữ bắt đầu bằng "Đã điểm danh lúc".
  5. Quay lại trang danh sách → "Đã vào 1 / 1".

  `afterAll` xóa sự kiện và user.
- [ ] **Step 2:** `npm run build && npm run e2e -- checkin`, với Supabase cục bộ đang chạy và `.env.test.local` như Kế hoạch 1. Kỳ vọng: FAIL (chưa có trang danh sách).
- [ ] **Step 3:** Cài trang danh sách và `AutoRefresh`.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`. Kỳ vọng: cả `register.spec.ts` và `checkin.spec.ts` qua. Sau đó `npx supabase stop`.
- [ ] **Step 5:** Commit `feat: attendee list with live count; e2e check-in flow`.

---

## Việc người dùng tự làm (không giao cho subagent)

1. **Chạy migration lên staging rồi prod**, mỗi project một lần, sau khi merge Task 1–3. Lệnh: `npx supabase link --project-ref <ref>` rồi `npx supabase db push --remote`.
2. **Thử máy quét trên iPhone Safari và một máy Android (Chrome)** qua link Preview: mở link mời, nhận vai trò, quét vé thật, thử cả rớt mạng (bật chế độ máy bay giữa chừng).
   - Ghi kết quả vào `docs/scan-test-results.md`.
   - **Chưa thử Android thì không dùng máy quét ở sự kiện thật.**
3. **Diễn tập tại đúng phòng của sự kiện pilot**, theo spec: mạng, ánh sáng, độ sáng màn hình, hai máy mỗi cửa, in danh sách giấy dự phòng tối hôm trước.

## Thứ tự và mốc

| Tuần | Task | Xong khi |
|---|---|---|
| 3 | 1, 2, 3, 4 | Test hai lượt điểm danh song song qua; test A/B qua; người soát vé nhận lời mời được |
| 4 | 5, 6, 7 | Quét được vé thật trên iPhone; E2E trọn luồng xanh trên CI; hàng đợi chịu được rớt mạng |

Nếu trễ, cắt theo thứ tự: Task 6 (hàng đợi) rồi tự tải lại 15 giây của Task 7 (thay bằng nút "Tải lại"). Không cắt Task 1, Task 2, tìm theo tên/MSSV, hay E2E.

## Kế hoạch tiếp theo

**Kế hoạch 3 — Sau sự kiện:**
- Xuất `.xlsx` (MSSV dạng text, thêm cột người quét và nguồn).
- Hủy vé trả chỗ (`cancel_ticket`).
- Lưu số tổng hợp trước khi xóa.
- Nút xóa dữ liệu và xóa tự động theo `purge_after`.
- Runbook ngày sự kiện.
- Các minor "có thể chờ" còn lại của review cuối Kế hoạch 1.
