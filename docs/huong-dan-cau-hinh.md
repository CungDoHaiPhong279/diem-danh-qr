# Hướng dẫn cấu hình (việc bạn tự làm)

Claude sẽ báo **"Cần cấu hình: mục X"** khi đến lúc. Bạn mở file này, làm đúng mục đó, rồi báo lại "xong mục X".

**Quy tắc an toàn**
- Không dán Client secret, Secret key, service_role key vào chat, vào code, hay vào file được commit.
- Chỉ dán vào: file `.env` / `.env.local` trong máy (git đã bỏ qua), hoặc trang cài đặt của Vercel/Supabase.
- Lưu mọi khóa và mật khẩu vào trình quản lý mật khẩu.

| Mục | Làm khi nào | Bắt buộc? | Thời gian |
|---|---|---|---|
| A. Đăng nhập Google trên máy | Khi muốn bấm thử giao diện quản lý (Task 4, 5 trở đi) | Không bắt buộc để code tiếp, nhưng nên làm | ~15 phút |
| B. Bảo vệ repo GitHub | Bất kỳ lúc nào | Nên làm | ~5 phút |
| C. Supabase cloud | Trước Task 8 | Có | ~15 phút |
| D. Google cho bản thật | Trước Task 8, sau C | Có | ~10 phút |
| E. Cloudflare Turnstile | Trước Task 8 | Có | ~5 phút |
| F. Sentry | Trước Task 8 | Có | ~5 phút |
| G. Vercel | Trước Task 8, sau C–F | Có | ~15 phút |
| H. Thử trên điện thoại | Task 9 | Có | ~30 phút |

Không cần làm: khóa Turnstile cho máy và bản Preview. Claude dùng khóa thử nghiệm công khai của Cloudflare.

---

## A. Đăng nhập Google trên máy

**A1. Tạo client OAuth**
1. Vào https://console.cloud.google.com, chọn project ở góc trên, rồi **New Project**, đặt tên `diem-danh-qr`.
2. Vào **APIs & Services → OAuth consent screen**. Giao diện mới có thể gọi là **Google Auth Platform**. Bấm **Get started**:
   - App name: `Điểm danh QR`. User support email: email của bạn.
   - Audience: **External**.
   - Contact email: email của bạn, rồi bấm **Create**.
   - Không cần thêm test user. App chỉ xin quyền cơ bản (email, profile, openid), nên tài khoản Google nào cũng đăng nhập được, kể cả khi app đang ở chế độ Testing.
3. Vào **Clients → Create client**:
   - Application type: **Web application**. Name: `diem-danh-qr`.
   - **Authorized JavaScript origins**: thêm `http://localhost:3000`.
   - **Authorized redirect URIs**: thêm `http://127.0.0.1:54321/auth/v1/callback`.
   - Bấm **Create**, chép **Client ID** và **Client secret** vào trình quản lý mật khẩu.

**A2. Đưa khóa vào Supabase trên máy**
1. Tạo file `C:\diem-danh-qr\.env`. Đây là file `.env` ở thư mục gốc dự án, không phải trong thư mục `supabase`, và git đã bỏ qua nó. Nội dung:
   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<Client ID>
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<Client secret>
   ```
2. Mở `supabase/config.toml`, tìm khối `[auth.external.google]`, đổi `enabled = false` thành `enabled = true`.
   - **Không commit thay đổi này.** CI không có khóa Google nên sẽ lỗi. Claude cũng sẽ không commit dòng này.
3. Mở Docker Desktop, rồi khởi động lại Supabase:
   ```bash
   npx supabase stop
   ```
   ```bash
   npx supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,realtime,supavisor,mailpit,postgres-meta
   ```

**A3. Thử đăng nhập**
1. Kiểm tra `.env.local` có 3 dòng thật, không còn chữ mẫu như `<API_URL>`:
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` lấy giá trị `ANON_KEY` từ lệnh `npx supabase status -o env`
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
2. Chạy `npm run dev`, mở http://localhost:3000/login, bấm nút Google. Đúng khi trang chuyển sang `/dashboard`.
3. Kiểm tra hồ sơ đã được tạo:
   ```bash
   docker exec supabase_db_diem-danh-qr psql -U postgres -c "select id, display_name from public.profiles"
   ```
   Đúng khi có 1 dòng.

**A4. Thử tạo sự kiện**
1. Ở `/dashboard`, tạo sự kiện mới với số chỗ là 10. Đúng khi trang quản lý hiện link `/e/...`, ảnh QR và `0 / 10`.
2. Bấm đóng/mở đăng ký 2 lần liên tiếp. Đúng khi trạng thái đổi đúng cả 2 lần.
3. Đổi số chỗ thành 0. Đúng khi bị từ chối.
4. Xong: tắt dev server bằng Ctrl+C, rồi chạy `npx supabase stop`.

Nếu lỗi: chụp màn hình gửi Claude. Nếu báo thiếu `client_id`, kiểm tra file `.env` có đúng ở thư mục gốc không.

---

## B. Bảo vệ repo GitHub

Repo đang để public, nên cần bật tính năng chặn lộ khóa.

1. Vào repo `diem-danh-qr` → **Settings → Code security** (hoặc **Advanced Security**). Bật:
   - **Dependabot alerts**
   - **Secret scanning**
   - **Push protection**: chặn push nếu có khóa lộ trong code.
2. Không bắt buộc: **Settings → Branches → Add rule** cho `main`, bật **Require status checks to pass**, rồi chọn các check `check` và `integration`.

---

## C. Supabase cloud

1. Vào https://supabase.com, tạo 2 project: `diem-danh-staging` và `diem-danh-prod`.
   - Region: **Southeast Asia (Singapore)**.
   - Database password: dùng mật khẩu ngẫu nhiên, lưu vào trình quản lý mật khẩu.
   - Gói Free cho tối đa 2 project chạy cùng lúc, đúng bằng 2 project này.
2. Với mỗi project, vào **Project Settings → API**, ghi lại vào trình quản lý mật khẩu:
   - Project URL, dạng `https://<ref>.supabase.co`, trong đó `<ref>` là mã project.
   - anon / publishable key.
   - service_role / secret key. Đây là khóa quan trọng nhất, ai có nó là toàn quyền với database.
3. Với mỗi project, vào **Authentication → Sign In / Providers → Email** và **tắt** Email. Ứng dụng chỉ dùng Google; để Email bật thì ai cũng tự tạo tài khoản qua API được.
4. Việc tạo bảng trên cloud (`supabase db push`) Claude sẽ hướng dẫn ở Task 8. Lúc đó bạn cần mật khẩu database của bước 1.

Lưu ý: project Free bị **tạm dừng sau 1 tuần không có truy cập**.
- Bản prod có cron `/api/health` gọi mỗi ngày để giữ project chạy. Claude làm việc này ở Task 8.
- Bản staging có thể bị dừng. Khi cần dùng, vào trang Supabase bấm **Restore**.

---

## D. Google cho bản thật

1. Quay lại client OAuth ở mục A1, phần **Authorized redirect URIs**, thêm 2 dòng:
   - `https://<ref-staging>.supabase.co/auth/v1/callback`
   - `https://<ref-prod>.supabase.co/auth/v1/callback`
2. Ở **Authorized JavaScript origins**, thêm domain Vercel sau khi có (mục G), ví dụ `https://diem-danh-qr.vercel.app`.
3. Trong **từng** project Supabase, vào **Authentication → Sign In / Providers → Google**:
   - Bật Google.
   - Dán Client ID và Client secret.
   - Bấm Save.
4. Trong **từng** project Supabase, vào **Authentication → URL Configuration**:
   - **prod**:
     - Site URL: `https://<domain-vercel>`.
     - Redirect URLs: thêm `https://<domain-vercel>/**`.
   - **staging**:
     - Site URL: `http://localhost:3000`.
     - Redirect URLs: thêm `http://localhost:3000/**` và `https://*-<tên-tài-khoản-vercel>.vercel.app/**`. Mẫu thứ hai dành cho các bản Preview của Vercel.
5. Trước khi cho người ngoài dùng: ở Google Cloud, vào **OAuth consent screen → Audience**, bấm **Publish app**.
   - App chỉ xin quyền cơ bản nên không cần Google duyệt.
   - Không nên tải logo lên, vì có logo thì Google bắt xác minh thương hiệu.

---

## E. Cloudflare Turnstile (chống bot ở form đăng ký)

1. Vào https://dash.cloudflare.com, chọn **Turnstile → Add widget**.
   - Widget name: `diem-danh-qr`.
   - Hostname: chỉ nhập domain prod, ví dụ `diem-danh-qr.vercel.app`. Không thêm `localhost`, vì máy và Preview dùng khóa thử nghiệm.
   - Widget mode: **Managed**.
2. Ghi lại **Site key** và **Secret key** vào trình quản lý mật khẩu.

---

## F. Sentry (theo dõi lỗi)

1. Vào https://sentry.io, tạo tài khoản Free, rồi **Create Project → Next.js**. Đặt tên `diem-danh-qr`.
2. Ghi lại **DSN**, dạng `https://...@...ingest.sentry.io/...`.
   - DSN không phải bí mật tuyệt đối, nhưng vẫn để trong biến môi trường.

---

## G. Vercel

1. Vào https://vercel.com, đăng nhập bằng GitHub, chọn **Add New → Project → Import** repo `diem-danh-qr`. Gói **Hobby**.
2. **Chưa bấm Deploy.** Mở **Environment Variables**, nhập các biến dưới đây.
   - Cột Production lấy khóa của project **prod**.
   - Cột Preview lấy khóa của project **staging**.

| Biến | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL prod (C2) | URL staging |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon prod | anon staging |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role prod | service_role staging |
| `NEXT_PUBLIC_SITE_URL` | `https://<domain-vercel>` | để trống (Claude xử lý ở Task 8) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key (E2) | `1x00000000000000000000AA` |
| `TURNSTILE_SECRET_KEY` | Secret key (E2) | `1x0000000000000000000000000000000AA` |
| `SENTRY_DSN` | DSN (F2) | DSN (F2) |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN (F2) | DSN (F2) |
| `CONTACT_EMAIL` | email liên hệ về dữ liệu, hiện trong câu đồng ý và trang /privacy (nên dùng email riêng cho dự án) | như Production |

3. Báo Claude "xong mục G". Claude sẽ hỏi bạn trước khi deploy lần đầu.
4. Có domain Vercel rồi thì quay lại hoàn thiện mục D2, D4 (prod) và E1.

---

## H. Thử trên điện thoại (Task 9)

Claude sẽ gửi link trang máy quét và bảng ghi kết quả. Bạn thử trên:
- iPhone/Safari và Android/Chrome.
- Trình duyệt bên trong Zalo.

Ghi lại: camera có mở được không, và quét mất bao lâu.
