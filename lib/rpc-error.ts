/** Maps RPC errors to Vietnamese messages; raw DB text never reaches the user. */
export function rpcErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "Bạn không có quyền làm việc này";
  if (error.message === "INVITE_INVALID") return "Link mời không còn hiệu lực. Hãy xin ban tổ chức link mới.";
  return "Có lỗi xảy ra, vui lòng thử lại";
}
