import { mm } from '@/core/types';
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
 * Shrinks the padding on each overflowing axis so the plate meets the drawer;
 * an axis that already fits keeps its padding, slack and all. The new total is
 * floored to 0.01mm so rounding can never land the plate over the drawer.
 */
export function fitPaddingToDrawer(
  current: PaddingState,
  gridWidthMm: number,
  gridDepthMm: number,
  measured: DrawerSizeMm
): AnchoredPaddings {
  const currentX = current.paddingLeft + current.paddingRight;
  const currentY = current.paddingFront + current.paddingBack;
  const overflows = (drawerMm: number, gridMm: number, padMm: number): boolean =>
    gridMm + padMm - drawerMm > OVERFLOW_EPSILON_MM;
  const slack = (drawerMm: number, gridMm: number): number =>
    Math.max(0, Math.floor((drawerMm - gridMm) * 100 + 1e-6) / 100);
  const shrinkX = overflows(measured.width, gridWidthMm, currentX);
  const shrinkY = overflows(measured.depth, gridDepthMm, currentY);
  const totals = {
    x: shrinkX ? slack(measured.width, gridWidthMm) : currentX,
    y: shrinkY ? slack(measured.depth, gridDepthMm) : currentY,
  };
  const anchor = current.paddingAnchor ?? 'custom';
  const share = (start: number, end: number): number =>
    start + end > 0 ? start / (start + end) : 0.5;
  const split =
    anchor !== 'custom'
      ? computeAnchoredPaddings(
          { paddingLeft: totals.x, paddingRight: 0, paddingFront: totals.y, paddingBack: 0 },
          anchor
        )
      : distributePaddings(totals, {
          x: share(current.paddingLeft, current.paddingRight),
          y: share(current.paddingBack, current.paddingFront),
        });
  return {
    ...split,
    ...(shrinkX
      ? {}
      : { paddingLeft: mm(current.paddingLeft), paddingRight: mm(current.paddingRight) }),
    ...(shrinkY
      ? {}
      : { paddingFront: mm(current.paddingFront), paddingBack: mm(current.paddingBack) }),
  };
}
