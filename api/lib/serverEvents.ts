import { waitUntil } from '@vercel/functions';

const CAPTURE_URL = 'https://us.i.posthog.com/i/v0/e/';
const SEND_TIMEOUT_MS = 5_000;

export type EventProperties = Record<string, unknown>;

/**
 * Sends one PostHog event from a function, in production only, after the
 * response. A failed send is dropped: analytics never fails a request.
 */
export function captureServerEvent(
  event: string,
  distinctId: string,
  properties: EventProperties
): void {
  const token = process.env.VITE_PUBLIC_POSTHOG_KEY;
  if (process.env.VERCEL_ENV !== 'production' || !token) return;
  waitUntil(
    fetch(CAPTURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        event,
        properties: { distinct_id: distinctId, $process_person_profile: false, ...properties },
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    }).then(
      () => undefined,
      () => undefined
    )
  );
}
