import { useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { flattenOutline } from '@/shared/utils/drawerOutlineGeometry';

interface DrawerOutlineOverlayProps {
  cellSize: number;
  gap: number;
}

/**
 * Visual overlay for a non-rectangular drawer (issue #2528): hatches the
 * region outside the outline and strokes the boundary. One SVG with an
 * even-odd path (grid rect + outline subpath) — no per-cell elements, so a
 * 50×50 grid costs the same as a 2×2.
 *
 * Purely visual and `pointer-events: none`: placement truth lives in
 * `canPlaceBin` (same geometry predicate), so a hatched cell is exactly a
 * cell placement would reject.
 */
export function DrawerOutlineOverlay({ cellSize, gap }: DrawerOutlineOverlayProps) {
  const t = useTranslation();
  const patternId = useId();
  const { outline, width, depth, gridUnitMm } = useLayoutStore(
    useShallow((s) => ({
      outline: s.layout.drawer.outline,
      width: s.layout.drawer.width,
      depth: s.layout.drawer.depth,
      gridUnitMm: s.layout.gridUnitMm,
    }))
  );

  const unitPx = cellSize + gap;
  const totalW = width * unitPx - gap;
  const totalD = depth * unitPx - gap;

  const path = useMemo(() => {
    if (outline === undefined) return null;
    // Grid px space: origin top-left, outline mm space: origin bottom-left.
    // Interior unit boundaries sit mid-gap; the half-gap offset is invisible
    // at typical 2-4px gaps and irrelevant to placement (visual only).
    const px = (mm: number): number => Math.min(totalW, Math.max(0, (mm / gridUnitMm) * unitPx));
    const py = (mm: number): number =>
      totalD - Math.min(totalD, Math.max(0, (mm / gridUnitMm) * unitPx));
    const pts = flattenOutline(outline);
    const loop = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)}`)
      .join(' ');
    return {
      outside: `M0 0 H${totalW.toFixed(2)} V${totalD.toFixed(2)} H0 Z ${loop} Z`,
      boundary: `${loop} Z`,
    };
  }, [outline, gridUnitMm, unitPx, totalW, totalD]);

  if (path === null) return null;

  return (
    <svg
      aria-label={t('grid.drawerOutlineAria')}
      role="img"
      className="pointer-events-none absolute text-neutral-500 dark:text-neutral-400"
      style={{ left: gap, top: gap, zIndex: 6 }}
      width={totalW}
      height={totalD}
    >
      <defs>
        <pattern
          id={patternId}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="1.5" />
        </pattern>
      </defs>
      <path d={path.outside} fill={`url(#${patternId})`} fillRule="evenodd" opacity={0.35} />
      <path
        d={path.boundary}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        opacity={0.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
