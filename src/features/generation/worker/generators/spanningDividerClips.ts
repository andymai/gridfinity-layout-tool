/** Clips that let a spanning label tab clear the dividers it crosses. */

import { box } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { planLabelTabLayout } from '@/shared/utils/labelTabPlan';

/**
 * A footprint a wall-to-wall shelf passes over, in the bin-interior frame.
 * `zMin` is the shelf underside: divider material from there up is what the
 * shelf would otherwise collide with.
 */
export interface SpanningDividerClip {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin: number;
}

/**
 * Where a full-width shelf crosses the column dividers.
 *
 * `planSpanningTabAtRow` already assumes those dividers "pass beneath" the
 * span — but nothing ever shortened them, so they ran to the interior ceiling
 * and stood proud of any shelf sunk below it (a click-in socket's stacking
 * relief, or an explicit `label.height`), splitting the one continuous label
 * surface the feature exists to provide.
 *
 * Derived from the same layout plan the shelves themselves are built from, so
 * the clip and the shelf cannot drift apart. Both spanning shapes qualify: the
 * `label.span` feature and the socket plan's bin-spanning fallback.
 */
export function planSpanningDividerClips(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): SpanningDividerClip[] {
  if (!params.label.enabled) return [];
  const layout = planLabelTabLayout(params, innerW, innerD, wallHeight, wallThickness);
  if (!layout) return [];
  // Per-compartment tabs are bounded by the dividers rather than crossing
  // them, so there is nothing to clip.
  if (!layout.spanningFallback && params.label.span !== true) return [];

  const { dims } = layout;
  const zMin = dims.shelfTopZ - dims.shelfT;
  const clips: SpanningDividerClip[] = [];
  for (const row of layout.plannedRows) {
    const depthSign = row.anchor === 'back' ? -1 : 1;
    for (const slot of row.slots) {
      const yEnd = slot.positionY + depthSign * dims.tabDepth;
      clips.push({
        xMin: slot.tabXStart,
        xMax: slot.tabXStart + slot.tabWidth,
        yMin: Math.min(slot.positionY, yEnd),
        yMax: Math.max(slot.positionY, yEnd),
        zMin,
      });
    }
  }
  return clips;
}

/**
 * Cut tools for a clip set, each running from the shelf underside to `topZ`.
 *
 * `topZ` must clear whatever the caller is cutting (the interior ceiling, or a
 * collared rim) — the box only has to swallow the divider top, and overshooting
 * upward hits empty space.
 */
export function buildSpanningDividerClipTools(
  clips: readonly SpanningDividerClip[],
  topZ: number,
  offsetX = 0,
  offsetY = 0
): Shape3D[] {
  const tools: Shape3D[] = [];
  for (const c of clips) {
    const height = topZ - c.zMin;
    if (height <= 0) continue;
    const w = c.xMax - c.xMin;
    const d = c.yMax - c.yMin;
    if (w <= 0 || d <= 0) continue;
    tools.push(
      box(w, d, height, {
        at: [(c.xMin + c.xMax) / 2 + offsetX, (c.yMin + c.yMax) / 2 + offsetY, c.zMin + height / 2],
      })
    );
  }
  return tools;
}

/** Cache-key segment for a clip set. Empty string when nothing is clipped. */
export function spanningDividerClipsKey(clips: readonly SpanningDividerClip[]): string {
  if (clips.length === 0) return '';
  return clips
    .map((c) => [c.xMin, c.xMax, c.yMin, c.yMax, c.zMin].map((n) => n.toFixed(3)).join(','))
    .join(';');
}
