// Scans whose check-in request failed, kept in localStorage and re-sent later.
// Safe to replay: the server's checkin is idempotent per scanId.
export type QueuedScan = { scanId: string; eventId: string; token?: string; ticketId?: string; scannedAt: string };

const key = (eventId: string) => `scan-queue:${eventId}`;

export function enqueue(list: QueuedScan[], s: QueuedScan): QueuedScan[] {
  return list.some((x) => x.scanId === s.scanId) ? list : [...list, s];
}

export function remove(list: QueuedScan[], scanId: string): QueuedScan[] {
  return list.filter((x) => x.scanId !== scanId);
}

export function loadQueue(eventId: string): QueuedScan[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key(eventId)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is QueuedScan => typeof x?.scanId === "string" && typeof x?.scannedAt === "string") : [];
  } catch {
    return [];
  }
}

export function saveQueue(eventId: string, list: QueuedScan[]): void {
  try {
    if (list.length) localStorage.setItem(key(eventId), JSON.stringify(list));
    else localStorage.removeItem(key(eventId));
  } catch {}
}

/** Sends oldest first; stops at the first throw, counting it and everything after as failed. */
export async function flushQueue(list: QueuedScan[], send: (s: QueuedScan) => Promise<unknown>): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  for (const [i, s] of list.entries()) {
    try {
      await send(s);
    } catch {
      return { sent, failed: list.slice(i).map((x) => x.scanId) };
    }
    sent.push(s.scanId);
  }
  return { sent, failed: [] };
}
