import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: !!dsn,
  dataCollection: { userInfo: false, cookies: false, httpBodies: [], httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false } }, // v11 replaced sendDefaultPii
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
  // v11 streams spans by default; beforeSendTransaction is ignored, beforeSendSpan is not.
  beforeSendSpan: scrubEvent,
  beforeBreadcrumb: scrubEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
