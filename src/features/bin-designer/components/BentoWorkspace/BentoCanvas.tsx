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
import type { DividerTiltPreview } from '@/features/bin-designer/types';
import { rowKeyOf } from '../CompartmentEditor/useDividerTiltSubsection';
import { computeSegmentSpan, overlayLineGeom } from '../CompartmentEditor/dividerOverlayGeom';
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
  readonly dividerTiltPreview: DividerTiltPreview | null;
  readonly onResizeHandlePointerDown: (
    id: number,
    handle: ResizeHandleId,
    e: React.PointerEvent
  ) => void;
}

const HANDLE_PX = 9;
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

  const displayNumberOf = useMemo(() => {
    const order = getCompartmentReadingOrder(config);
    const map = new Map<number, number>();
    order.forEach((id, i) => map.set(id, i + 1));
    return map;
  }, [config]);

  const drawnRects = useMemo(
    () =>
      [...drawnIds]
        .map((id) => ({ id, rect: getCompartmentRect(config, id) }))
        .filter((entry): entry is { id: number; rect: CellRect } => entry.rect !== null),
    [config, drawnIds]
  );

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

  const selectedRect =
    selectedId !== null ? drawnRects.find((d) => d.id === selectedId)?.rect : undefined;

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

      {/* Background lattice: the undrawn 1×1 pockets */}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={originX + (i + 1) * cellPxW}
          y1={originY}
          x2={originX + (i + 1) * cellPxW}
          y2={originY + screenH}
          className="stroke-stroke-subtle"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={originX}
          y1={originY + (i + 1) * cellPxH}
          x2={originX + screenW}
          y2={originY + (i + 1) * cellPxH}
          className="stroke-stroke-subtle"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      ))}
      {Array.from({ length: rows - 1 }, (_, r) =>
        Array.from({ length: cols - 1 }, (_, c) => (
          <circle
            key={`d${r}-${c}`}
            cx={originX + (c + 1) * cellPxW}
            cy={originY + (r + 1) * cellPxH}
            r={1.75}
            className="fill-content-tertiary/40"
          />
        ))
      )}

      {/* Drawn compartments */}
      {drawnRects.map(({ id, rect }) => {
        const { x, y, w, h } = rectPx(rect);
        const label = config.compartmentTexts?.[id] ?? '';
        const isSelected = id === selectedId;
        const isHovered = id === hoveredId;
        const isMoving = id === movingId;
        const widthMm = Math.round(rect.w * (interiorW / cols));
        const depthMm = Math.round(rect.h * (interiorD / rows));
        return (
          <Fragment key={id}>
            <rect
              x={x + 1.5}
              y={y + 1.5}
              width={Math.max(0, w - 3)}
              height={Math.max(0, h - 3)}
              rx={5}
              style={{
                stroke: previewColor,
                fill: previewColor,
                fillOpacity: isSelected || isHovered ? 0.3 : 0.16,
                opacity: isMoving ? 0.4 : 1,
              }}
              strokeWidth={isSelected ? 2.5 : 1.5}
              data-testid={`bento-compartment-${id}`}
              data-selected={isSelected || undefined}
            />
            <foreignObject
              x={x + 3}
              y={y + 3}
              width={Math.max(0, w - 6)}
              height={Math.max(0, h - 6)}
              pointerEvents="none"
              style={{ opacity: isMoving ? 0.4 : 1 }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden text-center">
                {label ? (
                  <span className="max-w-full truncate px-1 text-xs font-medium text-content-primary">
                    {label}
                  </span>
                ) : null}
                {h > 34 && (
                  <span className="text-[10px] tabular-nums text-content-tertiary">
                    {t('binDesigner.bento.compartmentSize', { width: widthMm, depth: depthMm })}
                  </span>
                )}
              </div>
            </foreignObject>
            <text
              x={x + 8}
              y={y + 14}
              className="fill-content-tertiary text-[9px] tabular-nums"
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
        <rect
          {...(() => {
            const { x, y, w, h } = rectPx(ghost.rect);
            return { x: x + 1, y: y + 1, width: Math.max(0, w - 2), height: Math.max(0, h - 2) };
          })()}
          rx={5}
          strokeWidth={2}
          style={ghostStyle(ghost)}
          data-interaction-preview={ghost.kind}
          data-snap-state={ghost.valid ? 'valid' : 'invalid'}
          pointerEvents="none"
        />
      )}

      {/* Resize handles on the selection, idle only */}
      {selectedRect && selectedId !== null && !ghost && (
        <g data-testid="bento-resize-handles">
          {handlesFor(selectedRect).map(({ handle, hx, hy }) => (
            <rect
              key={handle}
              x={hx - HANDLE_PX / 2}
              y={hy - HANDLE_PX / 2}
              width={HANDLE_PX}
              height={HANDLE_PX}
              rx={2}
              className="fill-accent stroke-surface"
              strokeWidth={1.5}
              style={{ cursor: HANDLE_CURSORS[handle] }}
              role="button"
              aria-label={t('binDesigner.bento.resizeHandle', { handle })}
              onPointerDown={(e) => onResizeHandlePointerDown(selectedId, handle, e)}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
