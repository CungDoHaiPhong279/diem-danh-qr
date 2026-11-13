// The ticket token in /t/<32 hex> is a bearer secret: never let it reach logs or Sentry.
export function scrubToken(s: string): string {
  return s.replace(/\/t\/[0-9a-f]{32}/g, "/t/[token]");
}
