import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useTranslation } from '@/i18n';

interface DrawerMarginProps {
  cellSize: number;
  gap: number;
}

/**
 * Read-only representation of the drawer-fit margin (baseplate padding) around
 * the grid (#2462). A physical drawer is rarely an exact multiple of the grid
 * unit, so the baseplate carries per-side padding (mm) to fill the leftover;
 * that padding lives on the layout (`baseplateParams`) but the grid — expressed
 * in whole/half units — never showed it. This band draws that margin to scale
 * so users can see the extra space and design an edge bin's overhang to use it.
 *
 * Rendered behind `GridCanvas` inside the grid box: negative insets extend the
 * band outward per side by the padding, and the grid's own opaque background
 * covers the center, leaving only the margin ring visible. Purely visual and
 * `pointer-events: none` — the band overhangs the row/column axis labels on
 * padded sides, so it must never intercept their clicks. Padding is edited in
 * the Baseplate tab.
 */
export function DrawerMargin({ cellSize, gap }: DrawerMarginProps) {
  const t = useTranslation();
  const { gridUnitMm, paddingLeft, paddingRight, paddingFront, paddingBack, shaped } =
    useLayoutStore(
      useShallow((s) => ({
        gridUnitMm: s.layout.gridUnitMm,
        paddingLeft: s.layout.baseplateParams?.paddingLeft ?? 0,
        paddingRight: s.layout.baseplateParams?.paddingRight ?? 0,
        paddingFront: s.layout.baseplateParams?.paddingFront ?? 0,
        paddingBack: s.layout.baseplateParams?.paddingBack ?? 0,
        // Shaped drawers strip padding functionally (buildFullParams), so the
        // margin band would show space the plate doesn't actually have.
        shaped:
          s.layout.drawer.outline !== undefined &&
          s.layout.baseplateParams?.syncWithLayout !== false &&
          s.layout.baseplateParams?.stackPrint?.enabled !== true,
      }))
    );

  const left = Math.max(0, paddingLeft);
  const right = Math.max(0, paddingRight);
  const front = Math.max(0, paddingFront);
  const back = Math.max(0, paddingBack);

  // Nothing to show without a configured margin — or when the drawer shape
  // subsumes it (padding is functionally stripped for shaped plates).
  if (shaped || left + right + front + back <= 0) return null;

  // One grid unit spans `cellSize + gap` px (holds in half-grid mode too — the
  // per-unit pitch is invariant). Padding is a fraction of a unit in mm.
  const pxPerUnit = cellSize + gap;
  const toPx = (mm: number): number => (mm / gridUnitMm) * pxPerUnit;

  // Screen orientation: +Y (back) is up, -Y (front) is down; -X (left) / +X (right).
  return (
    <div
      className="pointer-events-none rounded-lg border border-dashed border-accent/50 bg-accent/5"
      style={{
        position: 'absolute',
        left: -toPx(left),
        right: -toPx(right),
        top: -toPx(back),
        bottom: -toPx(front),
        zIndex: 0,
      }}
      aria-label={t('grid.drawerMargin.tooltip')}
    />
  );
}
