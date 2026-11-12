const TZ = "Asia/Ho_Chi_Minh";

/** "Thứ Bảy, 05/12/2026" */
export function formatDate(iso: string) {
  const s = new Date(iso).toLocaleDateString("vi-VN", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "18:30" */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}
