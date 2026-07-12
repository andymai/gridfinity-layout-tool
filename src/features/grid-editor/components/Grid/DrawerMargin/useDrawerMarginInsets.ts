import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';

export interface DrawerMarginInsets {
  /** Left overhang in px (−X). */
  readonly left: number;
  /** Right overhang in px (+X). */
  readonly right: number;
  /** Front overhang in px (−Y, screen-down). */
  readonly front: number;
  /** Back overhang in px (+Y, screen-up). */
  readonly back: number;
}

/**
 * Per-side drawer-fit margin (baseplate padding) in px — the same geometry the
 * {@link DrawerMargin} band renders. Insets are 0 when there is no padding or the
 * drawer is shaped (padding is functionally stripped for shaped plates, so the
 * band isn't drawn).
 *
 * Shared so the band and the axis-label offsets that clear it stay in lockstep:
 * the row/column labels are opaque and sit above the band, so on padded sides
 * they'd cover the overhang unless pushed out by exactly these amounts (#2549).
 */
export function useDrawerMarginInsets(cellSize: number, gap: number): DrawerMarginInsets {
  const { gridUnitMm, paddingLeft, paddingRight, paddingFront, paddingBack, shaped } =
    useLayoutStore(
      useShallow((s) => ({
        gridUnitMm: s.layout.gridUnitMm,
        paddingLeft: s.layout.baseplateParams?.paddingLeft ?? 0,
        paddingRight: s.layout.baseplateParams?.paddingRight ?? 0,
        paddingFront: s.layout.baseplateParams?.paddingFront ?? 0,
        paddingBack: s.layout.baseplateParams?.paddingBack ?? 0,
        shaped:
          s.layout.drawer.outline !== undefined &&
          s.layout.baseplateParams?.syncWithLayout !== false &&
          s.layout.baseplateParams?.stackPrint?.enabled !== true,
      }))
    );

  if (shaped) return { left: 0, right: 0, front: 0, back: 0 };

  // One grid unit spans `cellSize + gap` px (holds in half-grid mode — the
  // per-unit pitch is invariant). Padding is a fraction of a unit in mm.
  const pxPerUnit = cellSize + gap;
  const toPx = (mm: number): number => (Math.max(0, mm) / gridUnitMm) * pxPerUnit;

  return {
    left: toPx(paddingLeft),
    right: toPx(paddingRight),
    front: toPx(paddingFront),
    back: toPx(paddingBack),
  };
}
