/** Only same-origin relative paths survive; everything else falls back to the dashboard. */
export function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !/[\u0000-\u001f\u007f\\]/.test(raw)) return raw;
  return "/dashboard";
}
