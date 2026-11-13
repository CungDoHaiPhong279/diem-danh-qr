# Kết quả thử máy quét QR trên điện thoại thật

## Cách thử

1. Mở `/scan-test` trên URL Vercel (HTTPS) bằng điện thoại cần thử.
2. Trên một màn hình khác (máy tính hoặc điện thoại khác), mở một vé thật để hiện mã QR.
3. Bấm "Bắt đầu quét", cho phép camera, đưa camera vào mã QR.
4. Ghi lại: có quét được không, "giải mã" và "từ lúc bấm" (ms), và dòng "Giống link vé".
5. Lặp lại dưới đèn phòng và trong phòng tối. Với Zalo: gửi link `/scan-test` cho chính mình và mở trong Zalo, ghi lại thông báo lỗi camera.

## Bảng kết quả

| Máy | Hệ điều hành | Trình duyệt | Ánh sáng | Quét được? | Thời gian (ms) | Ghi chú |
|---|---|---|---|---|---|---|
| iPhone | | Safari | Đèn phòng | | | |
| iPhone | iOS (chưa ghi bản) | Safari | Phòng tối, quét màn hình laptop đặt nghiêng | Có (13/11/2026) | Giải mã 5–13 ms; lần đọc đầu 3530 ms từ lúc camera bật (gồm tải bộ giải mã ~0,9 MB và lúc đưa máy vào mã) | Đọc đúng link vé, nhận là "Giống link vé". Giữ mã trước camera thì cứ ~2,5 giây ghi lại một lần (đúng cài đặt bỏ trùng). |
| Android | | Chrome | — | Chưa thử | — | Chưa có máy Android (13/11/2026). Phải thử trên một máy Android tầm trung trước khi dùng máy quét ở sự kiện thật (Kế hoạch 2). |
| iPhone | iOS | Link mở trong Zalo | — | Không (link Preview) | — | Link Preview bị Vercel khóa: trong Zalo trang không tải được CSS/JS, nút không chạy. Bản Production mở trong Zalo bình thường (trang vé hiện đủ giao diện). Người soát vé nên mở máy quét bằng Safari/Chrome. |
