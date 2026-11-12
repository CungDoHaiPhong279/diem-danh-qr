import { scrubToken } from "@/lib/scrub";

type Rec = Record<string, unknown>;

function scrubFields(o: Rec | undefined, keys: string[]) {
  if (!o) return;
  for (const k of keys) if (typeof o[k] === "string") o[k] = scrubToken(o[k] as string);
}

// Shared beforeSend/beforeSendTransaction for client, server and edge. Mutates and returns the event.
export function scrubEvent<
  E extends {
    request?: { url?: string; headers?: Record<string, string> };
    transaction?: string;
    breadcrumbs?: { message?: string; data?: Rec }[];
  },
>(event: E): E {
  scrubFields(event.request as Rec | undefined, ["url"]);
  scrubFields(event.request?.headers as Rec | undefined, ["referer", "Referer"]);
  scrubFields(event as Rec, ["transaction"]);
  for (const b of event.breadcrumbs ?? []) {
    scrubFields(b as Rec, ["message"]);
    scrubFields(b.data, ["url", "from", "to"]);
  }
  return event;
}
