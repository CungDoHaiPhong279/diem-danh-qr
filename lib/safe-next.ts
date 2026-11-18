/** Only same-origin relative paths survive; everything else falls back to the dashboard. */
export function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") && !/[\r\n]/.test(raw)) return raw;
  return "/dashboard";
}
