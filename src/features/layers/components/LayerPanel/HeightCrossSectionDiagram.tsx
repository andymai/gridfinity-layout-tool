import { useState, useCallback, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import type { Layer, LayerId } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { useTranslation } from '@/i18n';

const HEIGHT_EXPONENT = 0.55;
const ACCENT_STRIPE_WIDTH = 2.5;
const TRANSITION = '0.2s ease-out';
const HEIGHT_DEBOUNCE_MS = 400;

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
  editingLayerId: LayerId | null;
  onLayerClick: (layerId: LayerId) => void;
  onLayerHover: (layerId: LayerId | null) => void;
  onAddLayer: () => void;
  onReorder: (fromDisplayIndex: number, toDisplayIndex: number) => void;
  onNameChange: (layerId: LayerId, name: string) => void;
  onHeightChange: (layerId: LayerId, delta: number) => void;
  onDeleteLayer: (layerId: LayerId) => void;
  onEditingStart: (layerId: LayerId) => void;
  onEditingEnd: () => void;
  layerStats: Record<string, LayerStat>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      data-testid="grip-icon"
      aria-hidden="true"
      className={className}
    >
      {[3, 7, 11].map((cy) => (
        <g key={cy} fill="var(--text-disabled)">
          <circle cx={2.5} cy={cy} r={1.2} />
          <circle cx={7.5} cy={cy} r={1.2} />
        </g>
      ))}
    </svg>
  );
}

export function HeightCrossSectionDiagram({
  layers,
  drawerHeight,
  activeLayerId,
  hoveredLayerId,
  canAddLayer,
  editingLayerId,
  onLayerClick,
  onLayerHover,
  onAddLayer,
  onReorder,
  onNameChange,
  onHeightChange,
  onDeleteLayer,
  onEditingStart,
  onEditingEnd,
  layerStats,
}: HeightCrossSectionDiagramProps) {
  const t = useTranslation();
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [pendingDeltas, setPendingDeltas] = useState<Record<string, number>>({});
  const flushTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleDebouncedHeightChange = useCallback(
    (layerId: LayerId, delta: number) => {
      setPendingDeltas((prev) => ({ ...prev, [layerId]: (prev[layerId] ?? 0) + delta }));
      const existing = flushTimers.current[layerId];
      if (existing) clearTimeout(existing);
      flushTimers.current[layerId] = setTimeout(() => {
        setPendingDeltas((prev) => {
          const accumulated = prev[layerId] ?? 0;
          if (accumulated !== 0) onHeightChange(layerId, accumulated);
          const { [layerId]: _, ...rest } = prev;
          return rest;
        });
        const { [layerId]: _, ...restTimers } = flushTimers.current;
        flushTimers.current = restTimers;
      }, HEIGHT_DEBOUNCE_MS);
    },
    [onHeightChange]
  );

  useEffect(() => {
    const timers = flushTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const totalLayerHeight = layers.reduce((sum, l) => sum + l.height, 0);
  const unusedHeight = Math.max(0, drawerHeight - totalLayerHeight);

  const compress = (h: number) => Math.pow(h, HEIGHT_EXPONENT);
  const compressedTotal =
    layers.reduce((sum, l) => sum + compress(l.height), 0) + compress(unusedHeight);

  const segmentCount = layers.length + (unusedHeight > 0 ? 1 : 0);
  const minHeight = clamp(segmentCount * 28, 48, 100);
  const maxHeight = clamp(segmentCount * 60, 100, 240);

  const diagramHeight = Math.max(
    minHeight,
    Math.min(maxHeight, compressedTotal * (minHeight / compress(drawerHeight)))
  );
  const pxPerCompressedUnit = compressedTotal > 0 ? diagramHeight / compressedTotal : 1;

  const unusedPx = compress(unusedHeight) * pxPerCompressedUnit;

  const layerSegments = layers.reduce<{ layer: Layer; y: number; height: number }[]>(
    (acc, layer) => {
      const segmentHeight = compress(layer.height) * pxPerCompressedUnit;
      const segmentY =
        acc.length === 0 ? unusedPx : acc[acc.length - 1].y + acc[acc.length - 1].height;
      acc.push({ layer, y: segmentY, height: segmentHeight });
      return acc;
    },
    []
  );

  const hasMultipleLayers = layers.length > 1;

  const handleKeyDown = (layerId: LayerId) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onLayerClick(layerId);
    }
  };

  const handleMouseLeave = useCallback(() => onLayerHover(null), [onLayerHover]);

  useEffect(() => {
    if (editingLayerId !== null && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingLayerId]);

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

  const getFill = (isActive: boolean, isHovered: boolean) => {
    if (isActive) return 'var(--color-accent-muted)';
    if (isHovered) return 'var(--bg-active)';
    return 'var(--bg-elevated)';
  };

  return (
    <div className="w-full">
      <div
        className="flex-1 relative overflow-hidden"
        style={{ height: diagramHeight }}
        data-testid="content-area"
      >
        <div
          className="absolute inset-0 border pointer-events-none"
          style={{ borderColor: 'var(--border-subtle)' }}
        />

        {unusedHeight > 0 && (
          <div
            onClick={canAddLayer ? onAddLayer : undefined}
            data-testid="headroom-area"
            className="absolute left-0 right-0 flex items-center justify-center overflow-hidden"
            style={{
              top: 0,
              height: unusedPx,
              cursor: canAddLayer ? 'pointer' : 'default',
              transition: `height ${TRANSITION}`,
            }}
            title={canAddLayer ? t('layers.addNewLayer') : undefined}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'repeating-linear-gradient(45deg, transparent, transparent 3px, var(--text-disabled) 3px, var(--text-disabled) 3.5px)',
                opacity: 0.15,
              }}
            />
            {unusedPx >= 18 && (
              <span className="relative text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                {t('layers.unusedSpace', { height: unusedHeight })}
              </span>
            )}
          </div>
        )}

        {unusedHeight > 0 && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: unusedPx - 1,
              height: 1,
              borderBottom: '1px dashed var(--border-subtle)',
              zIndex: 1,
            }}
          />
        )}

        {layerSegments.map(({ layer, y: segY, height: segH }, displayIndex) => {
          const isActive = layer.id === activeLayerId;
          const isHovered = !isActive && layer.id === hoveredLayerId;
          const isDragging = dragSourceIndex === displayIndex;
          const isDropTarget = dropTargetIndex === displayIndex;
          const isEditing = editingLayerId === layer.id;
          const isLastSegment = displayIndex === layerSegments.length - 1;
          const pendingDelta = pendingDeltas[layer.id] ?? 0;
          const previewHeight = Math.max(CONSTRAINTS.MIN_LAYER_HEIGHT, layer.height + pendingDelta);
          const stat = layerStats[layer.id];
          const tooltipText = stat
            ? t('layers.segmentTooltip', {
                name: layer.name,
                coverage: stat.coverage,
                count: stat.binCount,
              })
            : layer.name;
          const showGrip = hasMultipleLayers && segH >= 16;

          return (
            <div
              key={layer.id}
              role="button"
              tabIndex={0}
              aria-label={t('layers.selectLayer', { name: layer.name })}
              title={tooltipText}
              data-layer-id={layer.id}
              data-testid={isHovered ? 'hover-highlight' : undefined}
              draggable={hasMultipleLayers && !isEditing}
              onClick={() => onLayerClick(layer.id)}
              onDoubleClick={() => onEditingStart(layer.id)}
              onKeyDown={handleKeyDown(layer.id)}
              onMouseEnter={() => onLayerHover(layer.id)}
              onMouseLeave={handleMouseLeave}
              onDragStart={(e) => handleDragStart(e, displayIndex)}
              onDragOver={(e) => handleDragOver(e, displayIndex)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className={`absolute left-0 right-0 ${hasMultipleLayers && !isEditing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
              style={{
                top: segY,
                height: segH,
                backgroundColor: getFill(isActive, isHovered),
                opacity: isDragging ? 0.4 : 1,
                borderBottom: isLastSegment ? 'none' : '1px solid var(--border-strong)',
                transition: `top ${TRANSITION}, height ${TRANSITION}, opacity ${TRANSITION}`,
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: ACCENT_STRIPE_WIDTH,
                    backgroundColor: 'var(--color-accent)',
                  }}
                />
              )}

              {segH >= 16 && (
                <div className="flex items-center justify-between h-full pl-3 pr-2">
                  {isActive && segH >= 20 ? (
                    <>
                      {isEditing ? (
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={layer.name}
                          onChange={(e) => {
                            e.stopPropagation();
                            onNameChange(layer.id, e.target.value);
                          }}
                          onBlur={onEditingEnd}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') onEditingEnd();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-surface-elevated rounded px-1 py-0.5 text-xs font-medium outline-none text-content min-w-0"
                          aria-label={t('layers.layerNamePlaceholder')}
                        />
                      ) : (
                        <span
                          className="truncate text-xs font-medium cursor-text"
                          style={{ color: 'var(--text-primary)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditingStart(layer.id);
                          }}
                          title={t('layers.clickToRename')}
                        >
                          {layer.name}
                        </span>
                      )}

                      <div
                        className="flex items-center gap-1 ml-1 flex-shrink-0"
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDebouncedHeightChange(layer.id, -1);
                          }}
                          disabled={previewHeight <= CONSTRAINTS.MIN_LAYER_HEIGHT}
                          className="w-5 h-5 flex items-center justify-center rounded text-content-disabled hover:text-content hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label={t('layers.decreaseHeight', { name: layer.name })}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 12H4"
                            />
                          </svg>
                        </button>
                        <span
                          className="text-[10px] tabular-nums min-w-[20px] text-center"
                          style={{
                            fontFamily: 'ui-monospace, monospace',
                            color: 'var(--text-tertiary)',
                          }}
                          title={t('layers.heightTooltip')}
                        >
                          {previewHeight}u
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDebouncedHeightChange(layer.id, 1);
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded text-content-disabled hover:text-content hover:bg-surface-hover transition-colors"
                          aria-label={t('layers.increaseHeight', { name: layer.name })}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>

                        {hasMultipleLayers && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteLayer(layer.id);
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded text-content-disabled hover:text-error hover:bg-surface-hover transition-colors ml-1"
                            title={t('layers.deleteTooltip')}
                            aria-label={t('layers.deleteLayerAria', { name: layer.name })}
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}

                        {showGrip && !isEditing && <GripIcon className="ml-0.5" />}
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        className="truncate text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {layer.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[11px]"
                          style={{
                            fontFamily: 'ui-monospace, monospace',
                            color: 'var(--text-disabled)',
                          }}
                        >
                          {layer.height}u
                        </span>
                        {showGrip && <GripIcon />}
                      </div>
                    </>
                  )}
                </div>
              )}

              {isDropTarget && dragSourceIndex !== null && (
                <div
                  className="absolute left-0 right-0"
                  style={{
                    [dragSourceIndex < displayIndex ? 'bottom' : 'top']: -1,
                    height: 2,
                    backgroundColor: 'var(--color-accent)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
