# Điểm danh QR

Web app cho câu lạc bộ sinh viên: tạo sự kiện, cho người tham gia đăng ký nhận vé QR, rồi quét vé bằng điện thoại để điểm danh tại cửa. Bản quét vẫn hoạt động khi mất mạng.

**Bản chạy thật:** https://diem-danh-qr-gamma.vercel.app

## Tính năng

**Ban tổ chức**
- Đăng nhập bằng Google và tạo sự kiện với tên, thời gian, địa điểm và số chỗ.
- Mở hoặc đóng đăng ký, đổi số chỗ. Mỗi sự kiện có link và ảnh QR đăng ký để chia sẻ.
- Mời người quét vé bằng link mời: thu hồi link hoặc xóa người quét bất kỳ lúc nào.
- Xem danh sách điểm danh:
  - con số "Đã vào X / Y", tự cập nhật mỗi 15 giây;
  - lọc Đã vào / Chưa đến;
  - tìm theo tên hoặc MSSV, không cần gõ dấu.

**Người tham gia**
- Đăng ký không cần tài khoản: điền họ tên, email, MSSV, lớp, khoa và đồng ý điều khoản. Form có Cloudflare Turnstile chống spam.
- Nhận trang vé riêng có mã QR và mã ngắn 4 ký tự.

**Người quét vé**
- Máy quét chạy ngay trên trình duyệt điện thoại, không cần cài app. Đã thử trên iPhone Safari.
- Kết quả hiện toàn màn hình kèm rung:
  - xanh: hợp lệ;
  - đỏ: đã vào rồi hoặc vé sai;
  - vàng: đang chờ mạng.
- Khi mất mạng, lượt quét được xếp hàng trong máy và tự gửi lại khi có mạng. Gửi lại nhiều lần cũng không bị tính trùng.
- Tìm thủ công theo tên hoặc MSSV khi vé không quét được.
- Màn hình được giữ sáng trong lúc quét.

## Công nghệ

| Phần | Dùng |
|---|---|
| Giao diện và máy chủ | Next.js 16 (App Router, Server Actions, Cache Components), React 19, Tailwind CSS 4 |
| Cơ sở dữ liệu và đăng nhập | Supabase: Postgres, Auth với Google, Row Level Security |
| Quét QR | `barcode-detector` (ZXing chạy bằng WebAssembly, tự host trong `public/zxing`) |
| Chống spam | Cloudflare Turnstile |
| Theo dõi lỗi | Sentry |
| Triển khai | Vercel (vùng Singapore) và GitHub Actions |
| Kiểm thử | Vitest (unit và tích hợp với Supabase chạy thật), Playwright (E2E) |

## Thiết kế đáng chú ý

- **Phân quyền ngay trong database.**
  - RLS giới hạn từng dòng theo vai trò `organizer` / `checker` của sự kiện.
  - Quyền theo cột chặn thành viên đọc `email` và `token` của vé.
  - Các thao tác nhạy cảm như đăng ký, điểm danh hay chấp nhận lời mời là hàm `security definer` trong Postgres, có khóa dòng để không vượt số chỗ hoặc điểm danh trùng.
- **Điểm danh idempotent.** Mỗi lượt quét có `scan_id` riêng. Gửi lại cùng `scan_id` chỉ trả về kết quả cũ, nhờ vậy hàng đợi offline có thể gửi lại an toàn.
- **Chỉ nhận QR do chính site phát hành.** Mã quét phải có đúng origin `NEXT_PUBLIC_SITE_URL`. QR lạ bị báo là không hợp lệ.
- **Tôn trọng dữ liệu cá nhân.**
  - Mỗi sự kiện có hạn xóa dữ liệu (`purge_after`), mặc định 30 ngày sau ngày diễn ra.
  - Token vé bị che trong log và Sentry.
  - Quy trình xóa dữ liệu có ở [docs/xoa-du-lieu.md](docs/xoa-du-lieu.md).

## Chạy trên máy

Cần có: Node.js 24, Docker Desktop (để chạy Supabase trên máy).

```bash
npm install
npx supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,realtime,supavisor,mailpit,postgres-meta
npx supabase status -o env
```

Chép `.env.example` thành `.env.local`, rồi điền các giá trị lấy từ lệnh `status` ở trên:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
CONTACT_EMAIL=you@example.com
```

Hai khóa Turnstile ở trên là khóa thử nghiệm công khai của Cloudflare. Sau đó chạy:

```bash
npm run dev
```

Mở http://localhost:3000. Muốn đăng nhập Google trên máy, làm theo mục A trong [docs/huong-dan-cau-hinh.md](docs/huong-dan-cau-hinh.md).

## Kiểm thử

| Lệnh | Kiểm tra gì |
|---|---|
| `npm run typecheck` | Kiểu TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit test: phân tích QR, hàng đợi offline, validate form… |
| `npm run test:int` | Test tích hợp với Supabase trên máy: RLS, quyền theo cột, đăng ký, điểm danh, lời mời |
| `npm run build` rồi `npm run e2e` | Playwright chạy bản build ở cổng 3100: đăng ký nhận vé, quét và xem danh sách |

Test tích hợp và E2E cần Supabase trên máy đang chạy. E2E cần `NEXT_PUBLIC_SITE_URL=http://localhost:3100` lúc build. CI trên GitHub Actions chạy toàn bộ các bước này cho mỗi push và pull request ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Triển khai

- **Vercel:**
  - nhánh `main` lên Production;
  - mỗi pull request có bản Preview riêng, nối với Supabase staging.
- **Database:**
  - migration nằm trong [supabase/migrations](supabase/migrations);
  - áp dụng bằng `npx supabase db push` cho từng project (staging rồi prod).
- **Cấu hình Supabase, Google, Turnstile, Sentry, Vercel:** xem từng bước trong [docs/huong-dan-cau-hinh.md](docs/huong-dan-cau-hinh.md).
- **Khi đổi `NEXT_PUBLIC_SITE_URL`:** phải deploy lại, và vé đã phát ở địa chỉ cũ sẽ không quét được nữa.

## Cấu trúc thư mục

```
app/
  e/[id]/            trang đăng ký sự kiện (công khai)
  t/[token]/         trang vé QR của người tham gia
  dashboard/         quản lý sự kiện, mời người quét
    events/[id]/scan/       máy quét
    events/[id]/attendees/  danh sách điểm danh
  invite/[token]/    chấp nhận lời mời quét vé
  scan-test/         trang thử camera / quét QR
components/          UI dùng chung, hook useQrScanner
lib/                 logic thuần: phân tích vé, hàng đợi quét, validate, Supabase client
supabase/migrations/ schema, RLS và các hàm RPC
tests/               unit và tích hợp (Vitest)
e2e/                 Playwright
docs/                hướng dẫn cấu hình, kết quả thử máy quét, quy trình xóa dữ liệu
```

## Lộ trình

- [x] Kế hoạch 1: nền móng, đăng ký và vé QR
- [x] Kế hoạch 2: điểm danh (máy quét, offline, mời người quét, danh sách)
- [ ] Kế hoạch 3: xuất Excel, hủy vé, tự xóa dữ liệu hết hạn, hướng dẫn cho ngày sự kiện
