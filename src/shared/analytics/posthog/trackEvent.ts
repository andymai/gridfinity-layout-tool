/**
 * Leaf-level event tracking primitives.
 *
 * Lives in its own module so consumers (notably src/core/store/labs.ts) can
 * import `trackEvent` without dragging in `./events` or `./metrics`. Those
 * modules import `useLabsStore`, which closes a static-import cycle that
 * the production bundler can project to a chunk-level cycle and crash on
 * boot. See issue #1466.
 *
 * Constraint when extending this file: do not introduce any import edge
 * that transitively reaches `./metrics` or any module that imports
 * `@/core/store/labs`. The current `./init` dependency is fine — it pulls
 * in the settings store, but neither settings nor anything it imports
 * reaches back into labs/metrics, so the graph stays acyclic.
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
