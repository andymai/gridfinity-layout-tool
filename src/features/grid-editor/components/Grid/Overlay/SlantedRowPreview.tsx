import { useLayoutStore } from '@/core/store';
import type { Coord, Rect, SlantConfig } from '@/core/types';
import { planPaintedRows } from '@/shared/hooks/interactions/paintSlantedRows';

/** The overlay's grid-to-pixel conversions, which know the drawer's fractional edges. */
export interface OverlayPlacement {
  left: (x: number) => number;
  top: (y: number, depth: number) => number;
  px: (units: number) => number;
  pxY: (units: number) => number;
}

interface SlantedRowPreviewProps {
  start: Coord;
  current: Coord;
  paintSize: { width: number; depth: number };
  slant: SlantConfig;
  minUnit: number;
  place: OverlayPlacement;
}

/** The rows a slanted paint gesture would place, with their end supports hatched. */
export function SlantedRowPreview({
  start,
  current,
  paintSize,
  slant,
  minUnit,
  place,
}: SlantedRowPreviewProps) {
  const layout = useLayoutStore((s) => s.layout);
  const rows = planPaintedRows({
    start,
    current,
    size: paintSize,
    slant,
    minSize: minUnit,
    layout,
  });
  const box = (rect: Rect) => ({
    position: 'absolute' as const,
    left: place.left(rect.x),
    top: place.top(rect.y, rect.depth),
    width: place.px(rect.width),
    height: place.pxY(rect.depth),
    pointerEvents: 'none' as const,
  });

  return (
    <>
      {rows.flatMap((row, r) => [
        ...row.bins.map((bin, i) => (
          <div
            key={`slanted-bin-${String(r)}-${String(i)}`}
            data-testid="slanted-row-bin"
            style={{
              ...box(bin),
              border: '1px solid var(--color-success)',
              backgroundColor: 'var(--color-green-15)',
            }}
          />
        )),
        <div
          key={`slanted-support-${String(r)}`}
          data-testid="slanted-row-support"
          style={{
            ...box(row.support),
            border: '1px dashed var(--color-success)',
            backgroundImage:
              'repeating-linear-gradient(45deg, var(--color-success) 0, var(--color-success) 1.5px, transparent 1.5px, transparent 6px)',
            opacity: 0.6,
          }}
        />,
      ])}
    </>
  );
}
