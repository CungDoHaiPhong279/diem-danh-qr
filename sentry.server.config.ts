import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: !!dsn,
  dataCollection: { userInfo: false, cookies: false, httpBodies: [], httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false } }, // v11 replaced sendDefaultPii
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
