import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: !!dsn,
  dataCollection: { userInfo: false, cookies: false, httpBodies: [] }, // v11 replaced sendDefaultPii
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
