import { useState, useEffect, useRef, useCallback, useId } from 'react';
import type { KeyboardEvent } from 'react';
import type { Layer, LayerId } from '@/core/types';
import { useTranslation } from '@/i18n';

/** Left-side ruler width in px */
const RULER_WIDTH = 20;
/** Fallback bar width before first measurement */
const DEFAULT_BAR_WIDTH = 200;
/** Base scale: pixels per height unit before clamping */
const PX_PER_UNIT = 10;
/** Min/max diagram height in px */
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 200;
/** Vertical padding so top/bottom ruler labels aren't clipped */
const PADDING_Y = 8;
/** Width of the accent stripe on the active segment's left edge */
const ACCENT_STRIPE_WIDTH = 2.5;
/** Transition duration for segment animations */
const TRANSITION = '0.2s ease-out';

interface LayerStat {
  coverage: number;
  binCount: number;
}

interface HeightCrossSectionDiagramProps {
  layers: Layer[];
  drawerHeight: number;
  activeLayerId: LayerId | null;
  hoveredLayerId: LayerId | null;
  canAddLayer: boolean;
  onLayerClick: (layerId: LayerId) => void;
  onLayerDoubleClick: (layerId: LayerId) => void;
  onLayerHover: (layerId: LayerId | null) => void;
  onAddLayer: () => void;
  onReorder: (fromDisplayIndex: number, toDisplayIndex: number) => void;
  layerStats: Record<string, LayerStat>;
}

/**
 * Interactive SVG cross-section diagram — the primary layer UI.
 * Supports click-to-select, double-click-to-rename, drag-to-reorder,
 * and click-headroom-to-add.
 */
export function HeightCrossSectionDiagram({
  layers,
  drawerHeight,
  activeLayerId,
  hoveredLayerId,
  canAddLayer,
  onLayerClick,
  onLayerDoubleClick,
  onLayerHover,
  onAddLayer,
  onReorder,
  layerStats,
}: HeightCrossSectionDiagramProps) {
  const t = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => setContainerWidth(el.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const barWidth = containerWidth > RULER_WIDTH ? containerWidth - RULER_WIDTH : DEFAULT_BAR_WIDTH;

  const totalLayerHeight = layers.reduce((sum, l) => sum + l.height, 0);
  const unusedHeight = Math.max(0, drawerHeight - totalLayerHeight);

  // Dynamic height: scale to drawer size, clamped
  const rawHeight = drawerHeight * PX_PER_UNIT;
  const diagramHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, rawHeight));
  const scale = diagramHeight / drawerHeight; // px per height unit

  // Build segments top-to-bottom: unused space first, then layers (top layer first)
  const unusedPx = unusedHeight * scale;

  const layerSegments = layers.reduce<{ layer: Layer; y: number; height: number }[]>(
    (acc, layer) => {
      const segmentHeight = layer.height * scale;
      const segmentY =
        acc.length === 0 ? unusedPx : acc[acc.length - 1].y + acc[acc.length - 1].height;
      acc.push({ layer, y: segmentY, height: segmentHeight });
      return acc;
    },
    []
  );

  // Build ruler: boundary ticks with unit values
  const boundaries: { y: number; unit: number }[] = [{ y: diagramHeight, unit: 0 }];
  let cumulative = 0;
  for (const seg of [...layerSegments].reverse()) {
    cumulative += seg.layer.height;
    boundaries.push({ y: diagramHeight - cumulative * scale, unit: cumulative });
  }
  if (unusedHeight > 0) {
    boundaries.push({ y: 0, unit: drawerHeight });
  }

  const handleKeyDown = (layerId: LayerId) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onLayerClick(layerId);
    }
  };

  const handleMouseLeave = useCallback(() => onLayerHover(null), [onLayerHover]);

  // Drag-to-reorder handlers
  const handleDragStart = (e: React.DragEvent, displayIndex: number) => {
    setDragSourceIndex(displayIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(displayIndex));
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  };

  const handleDragOver = (e: React.DragEvent, displayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSourceIndex === null || displayIndex === dragSourceIndex) {
      setDropTargetIndex(null);
      return;
    }
    setDropTargetIndex(displayIndex);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (
      dragSourceIndex !== null &&
      dropTargetIndex !== null &&
      dragSourceIndex !== dropTargetIndex
    ) {
      onReorder(dragSourceIndex, dropTargetIndex);
    }
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  };

  const svgHeight = diagramHeight + PADDING_Y * 2;
  const uniqueId = useId();
  const clipId = `cross-section-clip-${uniqueId}`;
  const hatchId = `cross-section-hatch-${uniqueId}`;
  const hasMultipleLayers = layers.length > 1;

  // Segment fill — use design system selection/hover tokens for clear state distinction
  const getFill = (isActive: boolean, isHovered: boolean) => {
    if (isActive) return 'var(--color-accent-muted)';
    if (isHovered) return 'var(--bg-active)';
    return 'var(--bg-elevated)';
  };

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width="100%"
        height={svgHeight}
        role="img"
        aria-label={t('layers.crossSection')}
        className="block"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={RULER_WIDTH} y={0} width={barWidth} height={diagramHeight} />
          </clipPath>
          {/* Subtle crosshatch for unused/headroom area */}
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width="6" height="6">
            <path
              d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2"
              stroke="var(--text-disabled)"
              strokeWidth="0.5"
              opacity="0.25"
            />
          </pattern>
        </defs>

        <g transform={`translate(0, ${PADDING_Y})`}>
          {/* Left ruler — tick marks with unit values */}
          <g aria-hidden="true">
            {boundaries.map((b, i) => (
              <g key={i}>
                <line
                  x1={RULER_WIDTH - 3}
                  y1={b.y}
                  x2={RULER_WIDTH}
                  y2={b.y}
                  stroke="var(--text-disabled)"
                  strokeWidth="1"
                />
                <text
                  x={RULER_WIDTH - 5}
                  y={b.y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-disabled)"
                  fontFamily="ui-monospace, monospace"
                >
                  {b.unit}
                </text>
              </g>
            ))}
          </g>

          {/* Clipped bar area */}
          <g clipPath={`url(#${clipId})`}>
            {/* Unused space / headroom at top */}
            {unusedHeight > 0 && (
              <g
                onClick={canAddLayer ? onAddLayer : undefined}
                cursor={canAddLayer ? 'pointer' : 'default'}
                data-testid="headroom-area"
              >
                <rect
                  x={RULER_WIDTH}
                  width={barWidth}
                  fill={`url(#${hatchId})`}
                  stroke="var(--border-subtle)"
                  strokeWidth="0.5"
                  strokeDasharray="4 3"
                  style={{
                    y: 0,
                    height: unusedPx,
                    transition: `y ${TRANSITION}, height ${TRANSITION}`,
                  }}
                />
                {unusedPx >= 18 && (
                  <text
                    x={RULER_WIDTH + barWidth / 2}
                    y={unusedPx / 2 + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--text-disabled)"
                  >
                    {t('layers.unusedSpace', { height: unusedHeight })}
                  </text>
                )}
                {canAddLayer && <title>{t('layers.addNewLayer')}</title>}
              </g>
            )}

            {/* Layer segments */}
            {layerSegments.map(({ layer, y: segY, height: segH }, displayIndex) => {
              const isActive = layer.id === activeLayerId;
              const isHovered = !isActive && layer.id === hoveredLayerId;
              const isDragging = dragSourceIndex === displayIndex;
              const isDropTarget = dropTargetIndex === displayIndex;
              const stat = layerStats[layer.id];
              const tooltipText = stat
                ? t('layers.segmentTooltip', {
                    name: layer.name,
                    coverage: stat.coverage,
                    count: stat.binCount,
                  })
                : layer.name;

              return (
                <g
                  key={layer.id}
                  role="button"
                  tabIndex={0}
                  aria-label={t('layers.selectLayer', { name: layer.name })}
                  onClick={() => onLayerClick(layer.id)}
                  onDoubleClick={() => onLayerDoubleClick(layer.id)}
                  onKeyDown={handleKeyDown(layer.id)}
                  onMouseEnter={() => onLayerHover(layer.id)}
                  onMouseLeave={handleMouseLeave}
                  cursor="pointer"
                  data-layer-id={layer.id}
                  opacity={isDragging ? 0.4 : 1}
                >
                  <title>{tooltipText}</title>

                  {/* Segment fill — single rect, color encodes state */}
                  <rect
                    x={RULER_WIDTH}
                    width={barWidth}
                    fill={getFill(isActive, isHovered)}
                    data-testid={isHovered ? 'hover-highlight' : undefined}
                    style={{
                      y: segY,
                      height: segH,
                      transition: `y ${TRANSITION}, height ${TRANSITION}`,
                    }}
                  />

                  {/* Segment divider line (bottom edge) */}
                  <line
                    x1={RULER_WIDTH}
                    x2={RULER_WIDTH + barWidth}
                    y1={segY + segH}
                    y2={segY + segH}
                    stroke="var(--border-subtle)"
                    strokeWidth="0.5"
                    style={{
                      transition: `y1 ${TRANSITION}, y2 ${TRANSITION}`,
                    }}
                  />

                  {/* Accent stripe on active segment's left edge */}
                  {isActive && (
                    <rect
                      x={RULER_WIDTH}
                      width={ACCENT_STRIPE_WIDTH}
                      fill="var(--color-accent)"
                      style={{
                        y: segY,
                        height: segH,
                        transition: `y ${TRANSITION}, height ${TRANSITION}`,
                      }}
                    />
                  )}

                  {/* Layer name (left-aligned, offset accounts for accent stripe) */}
                  {segH >= 16 && (
                    <text
                      x={RULER_WIDTH + 8}
                      y={segY + segH / 2 + 4}
                      fontSize="12"
                      fill={isActive ? 'var(--text-primary)' : 'var(--text-secondary)'}
                      fontWeight={400}
                    >
                      {layer.name}
                    </text>
                  )}

                  {/* Height label (right-aligned) */}
                  {segH >= 16 && (
                    <text
                      x={RULER_WIDTH + barWidth - 8}
                      y={segY + segH / 2 + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill={isActive ? 'var(--text-tertiary)' : 'var(--text-disabled)'}
                      fontFamily="ui-monospace, monospace"
                    >
                      {layer.height}u
                    </text>
                  )}

                  {/* Drop indicator line */}
                  {isDropTarget && dragSourceIndex !== null && (
                    <line
                      x1={RULER_WIDTH}
                      x2={RULER_WIDTH + barWidth}
                      y1={dragSourceIndex < displayIndex ? segY + segH : segY}
                      y2={dragSourceIndex < displayIndex ? segY + segH : segY}
                      stroke="var(--color-accent)"
                      strokeWidth="2"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Outer border (on top, outside clip) */}
          <rect
            x={RULER_WIDTH}
            y={0}
            width={barWidth}
            height={diagramHeight}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />
        </g>
      </svg>

      {/* Invisible drag overlay divs — positioned over each segment for HTML5 DnD */}
      {hasMultipleLayers && (
        <div
          className="relative"
          style={{
            marginTop: -svgHeight + PADDING_Y,
            height: diagramHeight,
            pointerEvents: 'none',
          }}
        >
          {layerSegments.map(({ layer, y: segY, height: segH }, displayIndex) => (
            <div
              key={layer.id}
              draggable
              role="button"
              tabIndex={-1}
              onClick={() => onLayerClick(layer.id)}
              onDoubleClick={() => onLayerDoubleClick(layer.id)}
              onMouseEnter={() => onLayerHover(layer.id)}
              onMouseLeave={handleMouseLeave}
              onDragStart={(e) => handleDragStart(e, displayIndex)}
              onDragOver={(e) => handleDragOver(e, displayIndex)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className="absolute cursor-pointer active:cursor-grabbing"
              style={{
                left: RULER_WIDTH,
                top: segY,
                width: barWidth,
                height: segH,
                pointerEvents: 'auto',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
