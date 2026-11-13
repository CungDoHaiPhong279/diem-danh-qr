# Xóa dữ liệu đăng ký quá hạn (thủ công)

Thông báo quyền riêng tư hứa xóa dữ liệu sau 30 ngày kể từ ngày sự kiện (cột `events.purge_after`, tự đặt = `starts_at` + 30 ngày). Cho tới khi có xóa tự động (Kế hoạch 3), người vận hành chạy tay các bước sau.

**Cảnh báo:** xóa là KHÔNG THỂ KHÔI PHỤC. Trước khi chạy, kiểm tra tên project ở góc trên trái Supabase Dashboard đúng là project PROD (không phải staging), và đã xuất bản sao nếu cần.

## Cách làm

1. Vào Supabase Dashboard, chọn project PROD, mở **SQL Editor**.
2. Chạy câu lệnh xem trước, để biết sự kiện nào đến hạn và có bao nhiêu vé:

```sql
select e.id, e.title, e.club_name, e.starts_at, e.purge_after, count(t.id) as so_ve
from public.events e
left join public.tickets t on t.event_id = e.id
where e.purge_after < now()
group by e.id
order by e.purge_after;
```

3. Nếu danh sách đúng như dự kiến, chạy khối sau (trong một giao dịch). Xóa vé và lịch sử điểm danh của các sự kiện đến hạn; bản ghi sự kiện (tiêu đề, thời gian) được giữ lại:

```sql
begin;
delete from public.checkin_events
where event_id in (select id from public.events where purge_after < now());
delete from public.tickets
where event_id in (select id from public.events where purge_after < now());
-- Kiểm tra số dòng ở kết quả ở trên, rồi mới commit:
commit;  -- đổi thành rollback; nếu thấy có gì sai
```

4. Chạy lại câu lệnh ở bước 2: cột `so_ve` phải bằng 0.

Nên đặt lịch nhắc kiểm tra mỗi tháng và trước hạn của sự kiện thật đầu tiên.
