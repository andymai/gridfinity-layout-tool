/**
 * Counts of the point edits made while a path's points are open, sent as one
 * event when they close. One event per editing session, not per drag: a fix
 * to a traced edge can take dozens of small moves.
 */

import { trackEvent } from '@/shared/analytics/posthog/trackEvent';

export type PointEditTool =
  'move' | 'move_many' | 'handle' | 'add' | 'delete' | 'nudge' | 'transform' | 'kind' | 'pull';

const counts = new Map<PointEditTool, number>();

export function countPointEdit(tool: PointEditTool): void {
  counts.set(tool, (counts.get(tool) ?? 0) + 1);
}

/** Send what this session edited, if anything, and start the next one from zero. */
export function reportPointEdits(): void {
  if (counts.size === 0) return;
  const props: Record<string, number> = {};
  let edits = 0;
  for (const [tool, n] of counts) {
    props[tool] = n;
    edits += n;
  }
  counts.clear();
  trackEvent('cutout_points_edited', { edits, ...props });
}
