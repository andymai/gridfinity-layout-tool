/**
 * SVG renderer for the Bento workspace canvas.
 *
 * Pure projection of the compartment model + in-flight gesture: background
 * grid (the undrawn 1×1 pockets, rendered as faint lattice), drawn
 * compartments as first-class objects (layout-planner look), tilted-wall
 * indicator lines, the three-state gesture ghost (valid / invalid, matching
 * the layout's color formula and `data-interaction-preview` /
 * `data-snap-state` test contract), and resize handles on the selection.
 *
 * All geometry is screen px derived from the camera (`zoom` px/mm, center in
 * interior mm, Y up); the SVG's Y is flipped at projection time, never with
 * transforms, so text renders upright.
 */

import { Fragment, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import {
  getCompartmentReadingOrder,
  getEligibleDividers,
} from '@/features/bin-designer/utils/compartments';
import { getCompartmentRect, type CellRect } from '@/features/bin-designer/utils/bentoDraw';
import {
  cellRegionLoops,
  regionPathD,
  widestRunRect,
  type CellCorner,
} from '@/features/bin-designer/utils/bentoRegion';
import type { DividerTiltPreview } from '@/features/bin-designer/types';
import { rowKeyOf } from '@/features/bin-designer/components/CompartmentEditor/useDividerTiltSubsection';
import {
  computeSegmentSpan,
  overlayLineGeom,
} from '@/features/bin-designer/components/CompartmentEditor/dividerOverlayGeom';
import type { BentoGhost, ResizeHandleId } from './useBentoInteraction';

export interface BentoCanvasCamera {
  readonly zoom: number;
  readonly cameraCenter: { readonly x: number; readonly y: number };
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

export interface BentoCanvasProps {
  readonly config: CompartmentConfig;
  readonly interiorW: number;
  readonly interiorD: number;
  readonly camera: BentoCanvasCamera;
  readonly drawnIds: ReadonlySet<number>;
  readonly selectedId: number | null;
  readonly hoveredId: number | null;
  readonly previewColor: string;
  readonly ghost: BentoGhost | null;
  /** ID being moved right now — rendered dimmed like a dragged layout bin. */
  readonly movingId: number | null;
  /**
   * The compartment a gesture just landed, with a token that changes on every
   * landing. Keyed into the element so the settle animation replays when the
   * same compartment is dropped twice running.
   */
  readonly drop: { readonly id: number; readonly token: number } | null;
  /**
   * Draw faint resize handles on the HOVERED compartment as well as the
   * selected one (`Bin.tsx` does the same for layout bins). Off for touch,
   * which has no hover and would leave them permanently stuck on the last
   * thing tapped.
   */
  readonly showHoverHandles: boolean;
  readonly dividerTiltPreview: DividerTiltPreview | null;
  readonly onResizeHandlePointerDown: (
    id: number,
    handle: ResizeHandleId,
    e: React.PointerEvent
  ) => void;
}

const HANDLE_PX = 9;
const HANDLE_HIT_PX = 20;
/** Live-size chip above the gesture ghost. */
const SIZE_BADGE_H_PX = 20;
const SIZE_BADGE_MIN_W_PX = 72;
const HANDLE_CURSORS: Record<ResizeHandleId, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

export function BentoCanvas({
  config,
  interiorW,
  interiorD,
  camera,
  drawnIds,
  selectedId,
  hoveredId,
  previewColor,
  ghost,
  movingId,
  drop,
  showHoverHandles,
  dividerTiltPreview,
  onResizeHandlePointerDown,
}: BentoCanvasProps) {
  const t = useTranslation();
  const { cols, rows } = config;
  const { zoom, cameraCenter, canvasWidth, canvasHeight } = camera;

  // Interior top-left corner in screen px; every projection hangs off it.
  const originX = canvasWidth / 2 - cameraCenter.x * zoom;
  const originY = canvasHeight / 2 + cameraCenter.y * zoom - interiorD * zoom;
  const screenW = interiorW * zoom;
  const screenH = interiorD * zoom;
  const cellPxW = screenW / cols;
  const cellPxH = screenH / rows;

  // CellRect (row 0 = front/bottom) → screen px rect.
  const rectPx = (rect: CellRect) => ({
    x: originX + rect.col * cellPxW,
    y: originY + screenH - (rect.row + rect.h) * cellPxH,
    w: rect.w * cellPxW,
    h: rect.h * cellPxH,
  });

  // Cell-corner (row 0 = front/bottom) → screen px, for region outlines.
  const cornerPx = (corner: CellCorner): { x: number; y: number } => ({
    x: originX + corner.col * cellPxW,
    y: originY + screenH - corner.row * cellPxH,
  });

  const cellsById = useMemo(() => {
    const map = new Map<number, number[]>();
    config.cells.forEach((id, idx) => {
      const list = map.get(id);
      if (list) list.push(idx);
      else map.set(id, [idx]);
    });
    return map;
  }, [config.cells]);

  // Ordinals count DRAWN compartments only. Numbering every background
  // pocket produced labels like "Compartment 6" for the third thing the user
  // drew, and the numbers reshuffled whenever a pocket's reading-order slot
  // moved.
  const displayNumberOf = useMemo(() => {
    const map = new Map<number, number>();
    let ordinal = 0;
    for (const id of getCompartmentReadingOrder(config)) {
      if (drawnIds.has(id)) map.set(id, ++ordinal);
    }
    return map;
  }, [config, drawnIds]);

  /**
   * One entry per drawn compartment. `region` is null for the ordinary case —
   * a compartment that fills its bounding box, drawn as one rect — and carries
   * the outline loops for a merged L, S, T or U.
   */
  const drawnRects = useMemo(
    () =>
      [...drawnIds]
        .map((id) => {
          const rect = getCompartmentRect(config, id);
          if (!rect) return null;
          const cells = cellsById.get(id) ?? [];
          const fillsRect = cells.length === rect.w * rect.h;
          return {
            id,
            rect,
            region: fillsRect ? null : cellRegionLoops(cols, rows, cells),
            labelRect: fillsRect ? rect : widestRunRect(cols, cells),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [config, drawnIds, cellsById, cols, rows]
  );

  /**
   * Merged leftover regions, drawn as one shape each. Off in the default mode,
   * where every leftover cell is its own pocket and renders as its own rect.
   */
  const backgroundRegions = useMemo(() => {
    const ids = config.backgroundIds;
    if (!ids || ids.length === 0) return [];
    return ids
      .map((id) => ({ id, cells: cellsById.get(id) ?? [] }))
      .filter(({ cells }) => cells.length > 1)
      .map(({ id, cells }) => ({ id, loops: cellRegionLoops(cols, rows, cells) }));
  }, [config.backgroundIds, cellsById, cols, rows]);

  const mergedBackgroundCells = useMemo(() => {
    const set = new Set<number>();
    for (const region of backgroundRegions) {
      for (const idx of cellsById.get(region.id) ?? []) set.add(idx);
    }
    return set;
  }, [backgroundRegions, cellsById]);

  // Tilted/shifted walls: committed overrides plus the dock's live preview.
  const tiltLines = useMemo(() => {
    const eligible = getEligibleDividers(config);
    const lines: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
    for (const divider of eligible) {
      const key = rowKeyOf(divider.compartmentA, divider.compartmentB);
      const preview = dividerTiltPreview?.key === key ? dividerTiltPreview : null;
      const offsetStart = preview ? preview.offsetStart : divider.offsetStart;
      const offsetEnd = preview ? preview.offsetEnd : divider.offsetEnd;
      if (offsetStart === 0 && offsetEnd === 0) continue;
      const span = computeSegmentSpan(config, divider);
      if (!span) continue;
      const geom = overlayLineGeom(span, offsetStart, offsetEnd, interiorW, interiorD);
      lines.push({
        key,
        x1: (geom.x1 / 100) * screenW,
        y1: (geom.y1 / 100) * screenH,
        x2: (geom.x2 / 100) * screenW,
        y2: (geom.y2 / 100) * screenH,
      });
    }
    return lines;
  }, [config, dividerTiltPreview, interiorW, interiorD, screenW, screenH]);

  const ghostStyle = (g: BentoGhost): React.CSSProperties => {
    if (!g.valid) {
      return {
        stroke: 'var(--color-error)',
        fill: 'var(--color-error-muted)',
        strokeDasharray: g.kind === 'draw' || g.kind === 'stashDrag' ? '6 4' : undefined,
      };
    }
    if (g.kind === 'draw') {
      return {
        stroke: 'var(--color-warning)',
        fill: 'var(--color-warning-muted)',
        strokeDasharray: '6 4',
      };
    }
    return {
      stroke: 'var(--color-success)',
      fill: 'var(--color-success-muted)',
      strokeDasharray: g.kind === 'stashDrag' ? '6 4' : undefined,
    };
  };

  // A merged shape has no rectangle to pull on — a resize handle would offer
  // to reshape it into its own bounding box, notch included.
  const resizableRect = (id: number): CellRect | undefined => {
    const entry = drawnRects.find((d) => d.id === id);
    return entry && entry.region === null ? entry.rect : undefined;
  };

  const selectedRect = selectedId !== null ? resizableRect(selectedId) : undefined;

  // The selection owns the handles; the hovered compartment only borrows them
  // when nothing is selected, so hovering a neighbour never moves the grab
  // targets off the thing the user is working on.
  const hoverRect =
    showHoverHandles && hoveredId !== null && hoveredId !== selectedId
      ? resizableRect(hoveredId)
      : undefined;
  const handleTarget =
    selectedRect && selectedId !== null
      ? { id: selectedId, rect: selectedRect, ghost: false }
      : hoverRect && hoveredId !== null
        ? { id: hoveredId, rect: hoverRect, ghost: true }
        : null;

  const ghostPx = (() => {
    if (!ghost) return { x: 0, y: 0, width: 0, height: 0 };
    const { x, y, w, h } = rectPx(ghost.rect);
    return { x: x + 1, y: y + 1, width: Math.max(0, w - 2), height: Math.max(0, h - 2) };
  })();

  const handlesFor = (rect: CellRect) => {
    const { x, y, w, h } = rectPx(rect);
    const cx = x + w / 2;
    const cy = y + h / 2;
    // 'n' is the back of the bin = visual top.
    return [
      { handle: 'nw' as const, hx: x, hy: y },
      { handle: 'n' as const, hx: cx, hy: y },
      { handle: 'ne' as const, hx: x + w, hy: y },
      { handle: 'w' as const, hx: x, hy: cy },
      { handle: 'e' as const, hx: x + w, hy: cy },
      { handle: 'sw' as const, hx: x, hy: y + h },
      { handle: 's' as const, hx: cx, hy: y + h },
      { handle: 'se' as const, hx: x + w, hy: y + h },
    ];
  };

  return (
    <svg
      width={canvasWidth}
      height={canvasHeight}
      className="absolute inset-0"
      role="application"
      aria-label={t('binDesigner.bento.canvasLabel', { cols, rows })}
      data-testid="bento-canvas"
    >
      {/* Interior surface */}
      <rect
        x={originX}
        y={originY}
        width={screenW}
        height={screenH}
        rx={4}
        className="fill-surface-elevated stroke-stroke-subtle"
        strokeWidth={1.5}
      />

      {/* Background cells drawn as what they ARE — 1×1 pockets. A dashed
          lattice read as "empty space", which contradicted the 3D preview
          showing a fully walled bin (the footer note alone wasn't enough). */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const id = config.cells[r * cols + c];
          if (drawnIds.has(id)) return null;
          if (mergedBackgroundCells.has(r * cols + c)) return null;
          const inset = Math.min(2, cellPxW / 8, cellPxH / 8);
          return (
            <rect
              key={`p${r}-${c}`}
              x={originX + c * cellPxW + inset}
              y={originY + screenH - (r + 1) * cellPxH + inset}
              width={Math.max(0, cellPxW - 2 * inset)}
              height={Math.max(0, cellPxH - 2 * inset)}
              rx={3}
              className="fill-surface stroke-stroke-subtle"
              strokeWidth={0.75}
              data-testid="bento-pocket"
            />
          );
        })
      )}

      {/* Merged leftover: one pocket per open area, so what the drawn
          compartments leave behind prints as an L, U or S rather than a field
          of 1×1s. `evenodd` opens the hole a ring encloses. */}
      {backgroundRegions.map(({ id, loops }) => (
        <path
          key={`bg${id}`}
          d={regionPathD(loops, cornerPx)}
          fillRule="evenodd"
          className="fill-surface stroke-stroke-subtle"
          strokeWidth={0.75}
          data-testid="bento-background-region"
        />
      ))}

      {/* Drawn compartments */}
      {drawnRects.map(({ id, rect, region, labelRect }) => {
        const { x, y, w, h } = rectPx(rect);
        const label = config.compartmentTexts?.[id] ?? '';
        const isSelected = id === selectedId;
        const isHovered = id === hoveredId;
        const isMoving = id === movingId;
        const widthMm = Math.round(rect.w * (interiorW / cols));
        const depthMm = Math.round(rect.h * (interiorD / rows));
        const justDropped = drop?.id === id;
        const bodyStyle: React.CSSProperties = {
          stroke: previewColor,
          fill: previewColor,
          fillOpacity: isSelected || isHovered ? 0.3 : 0.16,
          opacity: isMoving ? 0.4 : 1,
        };
        // A merged compartment's caption goes on its widest run: the centre of
        // an L or U is in the notch, over the neighbour.
        const caption = labelRect
          ? rectPx({ col: labelRect.col, row: labelRect.row, w: labelRect.w, h: 1 })
          : { x, y, w, h };
        const captionH = region ? caption.h : h;
        return (
          <Fragment key={justDropped ? `${id}-drop${drop.token}` : id}>
            {region ? (
              <path
                d={regionPathD(region, cornerPx)}
                fillRule="evenodd"
                className={justDropped ? 'animate-bento-drop' : undefined}
                style={bodyStyle}
                strokeWidth={isSelected ? 2.5 : 1.5}
                data-testid={`bento-compartment-${id}`}
                data-shape="region"
                data-selected={isSelected || undefined}
              />
            ) : (
              <rect
                x={x + 1.5}
                y={y + 1.5}
                width={Math.max(0, w - 3)}
                height={Math.max(0, h - 3)}
                rx={5}
                className={justDropped ? 'animate-bento-drop' : undefined}
                style={bodyStyle}
                strokeWidth={isSelected ? 2.5 : 1.5}
                data-testid={`bento-compartment-${id}`}
                data-selected={isSelected || undefined}
              />
            )}
            <foreignObject
              x={caption.x + 3}
              y={caption.y + 3}
              width={Math.max(0, caption.w - 6)}
              height={Math.max(0, captionH - 6)}
              pointerEvents="none"
              style={{ opacity: isMoving ? 0.4 : 1 }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden text-center">
                {label ? (
                  <span className="max-w-full truncate px-1 text-xs font-medium text-content-primary">
                    {label}
                  </span>
                ) : null}
                {!region && h > 34 && (
                  <span className="text-micro tabular-nums text-content-tertiary">
                    {t('binDesigner.bento.compartmentSize', { width: widthMm, depth: depthMm })}
                  </span>
                )}
              </div>
            </foreignObject>
            <text
              x={caption.x + 8}
              y={caption.y + 14}
              className="fill-content-tertiary text-micro tabular-nums"
              pointerEvents="none"
              style={{ opacity: isMoving ? 0.4 : 1 }}
            >
              {displayNumberOf.get(id)}
            </text>
          </Fragment>
        );
      })}

      {/* Tilted / shifted walls (committed + dock live preview) */}
      {tiltLines.map((line) => (
        <line
          key={line.key}
          x1={originX + line.x1}
          y1={originY + line.y1}
          x2={originX + line.x2}
          y2={originY + line.y2}
          className="stroke-accent"
          strokeWidth={2.5}
          strokeLinecap="round"
          data-testid={`bento-tilt-${line.key}`}
        />
      ))}

      {/* Gesture ghost (hidden while a move hovers the stash shelf) */}
      {ghost && !ghost.overStash && (
        <>
          <rect
            {...ghostPx}
            rx={5}
            strokeWidth={2}
            style={ghostStyle(ghost)}
            data-interaction-preview={ghost.kind}
            data-snap-state={ghost.valid ? 'valid' : 'invalid'}
            pointerEvents="none"
          />
          {/* Live size, so a drag says what it is about to produce instead of
              only whether it fits. The draw gesture's footer hint carries the
              cell count; this is the millimetres, on the shape itself. */}
          <foreignObject
            x={ghostPx.x}
            y={Math.max(originY - SIZE_BADGE_H_PX, ghostPx.y - SIZE_BADGE_H_PX)}
            width={Math.max(SIZE_BADGE_MIN_W_PX, ghostPx.width)}
            height={SIZE_BADGE_H_PX}
            pointerEvents="none"
          >
            <div className="flex h-full items-center">
              <span
                className="rounded bg-surface/90 px-1.5 py-0.5 text-micro font-medium tabular-nums text-content-secondary shadow-sm"
                data-testid="bento-ghost-size"
              >
                {t('binDesigner.bento.sizeMm', {
                  w: Math.round(ghost.rect.w * (interiorW / cols)),
                  d: Math.round(ghost.rect.h * (interiorD / rows)),
                })}
              </span>
            </div>
          </foreignObject>
        </>
      )}

      {/* Resize handles, idle only. Each visible square gets an invisible twin
          at HANDLE_HIT_PX so the grab target isn't 9px. The hovered
          compartment gets a faint set too (layout-planner parity): otherwise
          every resize costs a click to select first. */}
      {!ghost && handleTarget && (
        <g
          data-testid="bento-resize-handles"
          data-variant={handleTarget.ghost ? 'ghost' : 'primary'}
          style={handleTarget.ghost ? { opacity: 0.45 } : undefined}
        >
          {handlesFor(handleTarget.rect).map(({ handle, hx, hy }) => (
            <g key={handle}>
              <rect
                x={hx - HANDLE_PX / 2}
                y={hy - HANDLE_PX / 2}
                width={HANDLE_PX}
                height={HANDLE_PX}
                rx={2}
                className="pointer-events-none fill-accent stroke-surface"
                strokeWidth={1.5}
              />
              <rect
                x={hx - HANDLE_HIT_PX / 2}
                y={hy - HANDLE_HIT_PX / 2}
                width={HANDLE_HIT_PX}
                height={HANDLE_HIT_PX}
                fill="transparent"
                style={{ cursor: HANDLE_CURSORS[handle] }}
                role="button"
                aria-label={t('binDesigner.bento.resizeHandle', { handle })}
                onPointerDown={(e) => onResizeHandlePointerDown(handleTarget.id, handle, e)}
              />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
