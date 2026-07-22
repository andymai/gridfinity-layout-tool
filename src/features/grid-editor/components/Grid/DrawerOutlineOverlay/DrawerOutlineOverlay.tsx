import { useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { getCellSizeY } from '@/core/constants';
import { effectiveGridUnitMmY } from '@/core/types';
import { useTranslation } from '@/i18n';
import { flattenOutline } from '@/shared/utils/drawerOutlineGeometry';
import { padOutline } from '@/shared/utils/padOutline';

interface DrawerOutlineOverlayProps {
  cellSize: number;
  gap: number;
}

/**
 * Visual overlay for a non-rectangular drawer (issue #2528): hatches the
 * region outside the outline, strokes the boundary, and — when the baseplate
 * carries per-side padding — draws the drawer-fit rim the plate gains around
 * the shape (#2705), the shaped counterpart of the rectangular {@link
 * DrawerMargin} band. One SVG, sized to the padded extent so the rim can
 * overhang the grid; even-odd paths keep a 50×50 grid as cheap as a 2×2.
 *
 * Purely visual and `pointer-events: none`: placement truth lives in
 * `canPlaceBin` (same geometry predicate), so a hatched cell is exactly a
 * cell placement would reject.
 */
export function DrawerOutlineOverlay({ cellSize, gap }: DrawerOutlineOverlayProps) {
  const t = useTranslation();
  const patternId = useId();
  const {
    outline,
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
  } = useLayoutStore(
    // Flat scalars only: a nested object literal here gets a fresh reference
    // every render, which useShallow reads as a change → infinite re-render.
    useShallow((s) => ({
      outline: s.layout.drawer.outline,
      width: s.layout.drawer.width,
      depth: s.layout.drawer.depth,
      gridUnitMm: s.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(s.layout),
      paddingLeft: s.layout.baseplateParams?.paddingLeft ?? 0,
      paddingRight: s.layout.baseplateParams?.paddingRight ?? 0,
      paddingFront: s.layout.baseplateParams?.paddingFront ?? 0,
      paddingBack: s.layout.baseplateParams?.paddingBack ?? 0,
    }))
  );

  // The depth (Y) axis uses the non-square pitch + row size, so the hatch tracks
  // the rectangular grid; both equal the X values for a square grid.
  const cellSizeY = getCellSizeY(cellSize, gridUnitMm, gridUnitMmY);
  const unitPx = cellSize + gap;
  const unitPxY = cellSizeY + gap;
  const gridW = width * unitPx - gap;
  const gridD = depth * unitPxY - gap;

  const geometry = useMemo(() => {
    if (outline === undefined) return null;

    // The rim is the padded plate minus the shape. It only exists when padding
    // is set AND composes (a padding that folds the loop is dropped by the
    // resolver too, so we mustn't imply a rim it won't get).
    const padding = {
      left: paddingLeft,
      right: paddingRight,
      front: paddingFront,
      back: paddingBack,
    };
    const hasPadding = paddingLeft + paddingRight + paddingFront + paddingBack > 0;
    const paddedOutline = hasPadding ? padOutline(outline, padding) : null;

    // Padding, in px, extends the canvas outward per side.
    const leftPx = (paddingLeft / gridUnitMm) * unitPx;
    const rightPx = (paddingRight / gridUnitMm) * unitPx;
    const backPx = (paddingBack / gridUnitMmY) * unitPxY;
    const frontPx = (paddingFront / gridUnitMmY) * unitPxY;
    const showRim = paddedOutline !== null;
    const padL = showRim ? leftPx : 0;
    const padR = showRim ? rightPx : 0;
    const padT = showRim ? backPx : 0;
    const padB = showRim ? frontPx : 0;

    const svgW = gridW + padL + padR;
    const svgH = gridD + padT + padB;

    // Everything is mapped in PLATE-local mm (origin at the padded plate's
    // bottom-left), so the padded outline maps directly and the drawer-local
    // shape is shifted in by (left, front) to sit at the grid's inset position.
    // With no padding this collapses to the plain drawer-local mapping.
    const gx = (mm: number): number => (mm / gridUnitMm) * unitPx;
    const gy = (mm: number): number => svgH - (mm / gridUnitMmY) * unitPxY;
    const loopFrom = (pts: readonly { x: number; y: number }[], tx = 0, ty = 0): string =>
      pts
        .map(
          (p, i) => `${i === 0 ? 'M' : 'L'}${gx(p.x + tx).toFixed(2)} ${gy(p.y + ty).toFixed(2)}`
        )
        .join(' ') + ' Z';

    // The shape sits at the grid's inset only when the rim is drawn; otherwise
    // it maps straight onto the grid extent (no canvas extension).
    const shapeTx = showRim ? paddingLeft : 0;
    const shapeTy = showRim ? paddingFront : 0;
    const shapeLoop = loopFrom(flattenOutline(outline), shapeTx, shapeTy);
    const plateLoop = paddedOutline !== null ? loopFrom(flattenOutline(paddedOutline)) : null;

    // Hatch outside the plate (or the shape when there's no rim) — never the rim
    // itself, which reads as the accent band instead.
    const outside = `M0 0 H${svgW.toFixed(2)} V${svgH.toFixed(2)} H0 Z ${plateLoop ?? shapeLoop}`;
    // The rim is the even-odd ring between the plate boundary and the shape.
    const rim = plateLoop !== null ? `${plateLoop} ${shapeLoop}` : null;
    const plateBoundary = plateLoop;

    return { svgW, svgH, offsetX: -padL, offsetY: -padT, outside, shapeLoop, rim, plateBoundary };
  }, [
    outline,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    gridUnitMm,
    gridUnitMmY,
    unitPx,
    unitPxY,
    gridW,
    gridD,
  ]);

  if (geometry === null) return null;

  return (
    <svg
      aria-label={t('grid.drawerOutlineAria')}
      role="img"
      className="pointer-events-none absolute text-neutral-500 dark:text-neutral-400"
      style={{ left: gap + geometry.offsetX, top: gap + geometry.offsetY, zIndex: 6 }}
      width={geometry.svgW}
      height={geometry.svgH}
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
      {/* Hatch everything outside the shape first, then paint the drawer-fit
          rim (plate padding around the shape) on top so it reads as plate, not
          void — the accent band matches the rectangular DrawerMargin. */}
      <path d={geometry.outside} fill={`url(#${patternId})`} fillRule="evenodd" opacity={0.35} />
      {geometry.rim !== null && (
        <path d={geometry.rim} className="fill-accent/10" fillRule="evenodd" />
      )}
      {geometry.plateBoundary !== null && (
        <path
          d={geometry.plateBoundary}
          fill="none"
          className="stroke-accent/60"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
      )}
      <path
        d={geometry.shapeLoop}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        opacity={0.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
