import type { PaddingAnchor } from '@/core/types';
import { computeAnchoredPaddings, distributePaddings } from './computeAnchoredPaddings';
import type { AnchoredPaddings } from './computeAnchoredPaddings';

/** Below this a plate counts as fitting its drawer. */
const OVERFLOW_EPSILON_MM = 0.05;

interface PaddingState {
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  readonly paddingAnchor?: PaddingAnchor;
}

interface DrawerSizeMm {
  readonly width: number;
  readonly depth: number;
}

export interface DrawerOverflowMm {
  readonly widthMm: number;
  readonly depthMm: number;
}

/** How far a plate's footprint runs past the measured drawer, or null when it fits. */
export function plateDrawerOverflow(
  outerWidthMm: number,
  outerDepthMm: number,
  measured: DrawerSizeMm
): DrawerOverflowMm | null {
  const widthMm = outerWidthMm - measured.width;
  const depthMm = outerDepthMm - measured.depth;
  if (widthMm <= OVERFLOW_EPSILON_MM && depthMm <= OVERFLOW_EPSILON_MM) return null;
  return { widthMm: Math.max(0, widthMm), depthMm: Math.max(0, depthMm) };
}

/**
 * Padding that grows the bare cells out to the measured drawer, split the way
 * the current padding is: by the anchor when one is chosen, otherwise in the
 * current proportions (evenly on an axis that has none). Floored to 0.01mm so
 * the plate never lands a hair over the drawer.
 */
export function fitPaddingToDrawer(
  current: PaddingState,
  gridWidthMm: number,
  gridDepthMm: number,
  measured: DrawerSizeMm
): AnchoredPaddings {
  const slack = (drawerMm: number, gridMm: number): number =>
    Math.max(0, Math.floor((drawerMm - gridMm) * 100 + 1e-6) / 100);
  const totals = {
    x: slack(measured.width, gridWidthMm),
    y: slack(measured.depth, gridDepthMm),
  };
  const anchor = current.paddingAnchor ?? 'custom';
  if (anchor !== 'custom') {
    return computeAnchoredPaddings(
      { paddingLeft: totals.x, paddingRight: 0, paddingFront: totals.y, paddingBack: 0 },
      anchor
    );
  }
  const share = (start: number, end: number): number =>
    start + end > 0 ? start / (start + end) : 0.5;
  return distributePaddings(totals, {
    x: share(current.paddingLeft, current.paddingRight),
    y: share(current.paddingBack, current.paddingFront),
  });
}
