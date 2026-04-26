/**
 * Leaf-level event tracking primitives.
 *
 * Lives in its own module so consumers (notably src/core/store/labs.ts) can
 * import `trackEvent` without dragging in `./events` or `./metrics`. Those
 * modules transitively read core stores, which would re-import this package
 * and form a static-import cycle in the production bundle. See issue #1466.
 *
 * Keep this file's imports minimal: only `./init` (the capture primitive)
 * and pure constants. Do NOT import any store or any module that imports
 * one — that's the whole point.
 */

import { BREAKPOINTS } from '@/core/constants';
import { capture } from './init';

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < BREAKPOINTS.MD) return 'mobile';
  if (width < BREAKPOINTS.LG) return 'tablet';
  return 'desktop';
}

/**
 * Track a discrete event (feature usage, actions).
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  try {
    capture(name, {
      device_type: getDeviceType(),
      ...properties,
    });
  } catch {
    // Fail silently
  }
}
