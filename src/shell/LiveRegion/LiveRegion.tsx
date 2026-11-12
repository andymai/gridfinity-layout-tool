import { useInteractionStore } from '@/core/store';

/**
 * ARIA live region for screen reader announcements.
 * Visually hidden but accessible to assistive technology.
 *
 * Usage: Call announceToScreenReader(message) from anywhere in the app.
 * The message will be announced and automatically cleared after 1 second.
 */
export function LiveRegion() {
  const liveMessage = useInteractionStore((state) => state.liveMessage);

  // Stays mounted while empty: screen readers announce a change inside a live
  // region that already exists, and often skip one inserted with its text.
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {liveMessage ?? ''}
    </div>
  );
}
