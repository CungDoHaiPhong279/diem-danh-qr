import { scrubToken } from "@/lib/scrub";

// Shared beforeSend/beforeSendTransaction/beforeBreadcrumb for client, server and edge.
// JSON-wide so no field (contexts, spans, headers, exception values) can leak a token.
export function scrubEvent<E>(event: E): E {
  return JSON.parse(scrubToken(JSON.stringify(event)));
}
