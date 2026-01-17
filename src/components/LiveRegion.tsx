import { useUIStore } from '../core/store';

/**
 * ARIA live region for screen reader announcements.
 * Visually hidden but accessible to assistive technology.
 *
 * Usage: Call announceToScreenReader(message) from anywhere in the app.
 * The message will be announced and automatically cleared after 1 second.
 */
export function LiveRegion() {
  const liveMessage = useUIStore(state => state.liveMessage);

  if (!liveMessage) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {liveMessage}
    </div>
  );
}
