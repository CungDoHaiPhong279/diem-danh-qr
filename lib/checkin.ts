// Runs in the browser too: no server-only imports.
const TICKET_PATH = /^\/t\/([0-9a-f]{32})$/;

export function parseTicketToken(raw: string, siteUrl: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.origin !== new URL(siteUrl).origin) return null;
    return TICKET_PATH.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

export type CheckinOutcome =
  | { kind: "ok"; name: string; studentId: string | null; checkedInAt: string }
  | { kind: "already"; name: string; studentId: string | null; checkedInAt: string; by: string }
  | { kind: "invalid"; reason: "not_found" | "wrong_event" | "cancelled" | "bad_qr" }
  | { kind: "forbidden" };

export function mapCheckinRow(row: Record<string, unknown>): CheckinOutcome {
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const base = () => ({
    name: str(row.name) ?? "",
    studentId: str(row.student_id),
    checkedInAt: str(row.checked_in_at) ?? "",
  });
  switch (row.result) {
    case "ok":
      return { kind: "ok", ...base() };
    case "already":
      return { kind: "already", ...base(), by: str(row.checked_in_by_name) ?? "không rõ" };
    case "not_found":
    case "wrong_event":
    case "cancelled":
      return { kind: "invalid", reason: row.result };
    default:
      throw new Error("Unexpected checkin result");
  }
}
