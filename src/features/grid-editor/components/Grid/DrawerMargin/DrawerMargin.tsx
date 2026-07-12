import { useTranslation } from '@/i18n';
import { useDrawerMarginInsets } from './useDrawerMarginInsets';

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
  const { left, right, front, back } = useDrawerMarginInsets(cellSize, gap);

  // Nothing to show without a configured margin — or when the drawer shape
  // subsumes it (padding is functionally stripped for shaped plates; the hook
  // returns all-zero insets in that case).
  if (left + right + front + back <= 0) return null;

  // Screen orientation: +Y (back) is up, -Y (front) is down; -X (left) / +X (right).
  return (
    <div
      className="pointer-events-none rounded-lg border border-dashed border-accent/50 bg-accent/5"
      style={{
        position: 'absolute',
        left: -left,
        right: -right,
        top: -back,
        bottom: -front,
        zIndex: 0,
      }}
      aria-label={t('grid.drawerMargin.tooltip')}
    />
  );
}
