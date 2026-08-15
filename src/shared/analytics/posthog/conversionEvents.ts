/**
 * Two-stage per-surface conversion funnel.
 *
 * `tool_activated` fires once per browser per surface (localStorage-guarded
 * like the engagement milestones) on the first meaningful edit in a tool.
 * `tool_converted` fires on every printable-file download and only for file
 * downloads — placing a designer bin into a layout counts as layout
 * activation, never as designer conversion.
 *
 * Leaf-tier module: only `./identity` and `./trackEvent` imports so Zustand
 * store code can deep-import it without re-opening the #1466 chunk cycle.
 */

import { loadAnalyticsData, saveAnalyticsData } from './identity';
import { trackEvent } from './trackEvent';

export type ToolSurface = 'layout' | 'designer' | 'baseplate';

export function trackToolActivated(surface: ToolSurface, action: string): void {
  try {
    const data = loadAnalyticsData();
    const milestoneKey = `tool_activated_${surface}`;
    if (data.milestones[milestoneKey]) return;
    data.milestones[milestoneKey] = new Date().toISOString();
    saveAnalyticsData(data);
    trackEvent('tool_activated', { surface, action });
  } catch {
    // Analytics should never break the app
  }
}

export interface ToolConvertedProperties {
  format: string;
  split?: boolean;
  piece_count?: number;
}

/**
 * Session flag: the user has received a printable file. Written here rather
 * than in the engagement feature so this module stays leaf-tier (see the
 * #1466 chunk-cycle note above) — hence raw sessionStorage over an import.
 */
export const CONVERTED_THIS_SESSION_KEY = 'gridfinity-converted-this-session';

export function hasConvertedThisSession(): boolean {
  try {
    return sessionStorage.getItem(CONVERTED_THIS_SESSION_KEY) !== null;
  } catch {
    return false;
  }
}

export function trackToolConverted(surface: ToolSurface, props: ToolConvertedProperties): void {
  try {
    sessionStorage.setItem(CONVERTED_THIS_SESSION_KEY, '1');
  } catch {
    // Storage may be unavailable; the nudge simply stays gated.
  }
  try {
    trackEvent('tool_converted', {
      surface,
      format: props.format,
      split: props.split ?? false,
      piece_count: props.piece_count ?? 1,
    });
  } catch {
    // Analytics should never break the app
  }
}
