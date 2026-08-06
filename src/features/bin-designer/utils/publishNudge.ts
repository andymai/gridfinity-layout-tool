/**
 * One-shot prompt to publish, offered after an export.
 *
 * An export is the moment a design is finished enough to be worth sharing,
 * which is why the offer rides it rather than sitting in the UI permanently.
 * It fires once per browser, ever: a suggestion that returns is an ask, and
 * the Community tool is already a standing entry point for anyone who wants
 * it.
 */

const NUDGE_KEY = 'gridfinity-community-publish-nudge-v1';

export function hasSeenPublishNudge(): boolean {
  try {
    return localStorage.getItem(NUDGE_KEY) !== null;
  } catch {
    // No storage means no way to remember a dismissal, so treat it as seen
    // rather than re-offering on every single export.
    return true;
  }
}

export function markPublishNudgeSeen(): void {
  try {
    localStorage.setItem(NUDGE_KEY, '1');
  } catch {
    // Nothing to do: the read path already fails closed.
  }
}
