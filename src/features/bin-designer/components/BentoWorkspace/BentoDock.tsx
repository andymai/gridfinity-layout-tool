/**
 * Docked compartment column for the Bento workspace: a list of drawn
 * compartments (reading order, matching the canvas badges) and, for the
 * selection, an inspector with the engraved label, footprint readout, wall
 * shift/angle steppers (the canvas no longer drags walls — this is their
 * home), and the duplicate/stash/delete actions.
 *
 * Shell (collapse rail, width drag, scroll shadow) mirrors the cutout
 * workspace's InspectorDock so the two editors feel like one product.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, IconButton, Stepper } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { getCompartmentReadingOrder } from '@/features/bin-designer/utils/compartments';
import { getCompartmentRect, type CellRect } from '@/features/bin-designer/utils/bentoDraw';
import {
  ANGLE_UI_MAX_DEG,
  ANGLE_UI_STEP_DEG,
  SHIFT_UI_STEP_MM,
} from '@/features/bin-designer/utils/dividerAngle';
import { CompartmentTextInput } from '@/features/bin-designer/components/panel/LabelTabsSection/CompartmentTextInput';
import { useDividerTiltSubsection } from '@/features/bin-designer/components/CompartmentEditor/useDividerTiltSubsection';
import { BentoBinWideSection } from './BentoBinWideSection';
import { BentoCompartmentColorControls } from './BentoCompartmentColorControls';
import {
  BENTO_DOCK_MAX_WIDTH,
  BENTO_DOCK_MIN_WIDTH,
  loadBentoDockCollapsed,
  loadBentoDockWidth,
  saveBentoDockCollapsed,
  saveBentoDockWidth,
} from './bentoDockStorage';

export interface BentoDockProps {
  readonly config: CompartmentConfig;
  readonly drawnIds: ReadonlySet<number>;
  readonly interiorW: number;
  readonly interiorD: number;
  readonly selectedId: number | null;
  readonly onSelect: (id: number | null) => void;
  /**
   * Set (and bumped) only when the canvas explicitly requests a label edit
   * for the CURRENT selection (double-click / context menu). Must stay
   * undefined otherwise: CompartmentTextInput focuses whenever the token is
   * defined at mount, and an always-defined token steals keyboard focus on
   * every selection — killing arrow-nudge and Delete on the canvas.
   */
  readonly labelFocusToken?: number;
  readonly onCommitLabel: (id: number, value: string) => void;
  readonly onDuplicate: (id: number) => void;
  readonly onStash: (id: number) => void;
  readonly onDelete: (id: number) => void;
}

const ICON_BTN =
  'flex-shrink-0 rounded-md p-1.5 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content disabled:pointer-events-none disabled:opacity-40';

function Icon({ paths }: { readonly paths: readonly string[] }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

export function BentoDock({
  config,
  drawnIds,
  interiorW,
  interiorD,
  selectedId,
  onSelect,
  labelFocusToken,
  onCommitLabel,
  onDuplicate,
  onStash,
  onDelete,
}: BentoDockProps) {
  const t = useTranslation();
  const { labelSpan, labelEnabled } = useDesignerStore(
    useShallow((s) => ({
      labelSpan: s.params.label.span === true,
      labelEnabled: s.params.label.enabled,
    }))
  );
  const [width, setWidth] = useState(loadBentoDockWidth);
  const [collapsed, setCollapsed] = useState(loadBentoDockCollapsed);
  const [isScrolled, setIsScrolled] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const tilt = useDividerTiltSubsection();

  const cellWmm = interiorW / config.cols;
  const cellHmm = interiorD / config.rows;

  // Ordinals count drawn compartments only — background pockets are not part
  // of this surface's vocabulary (mirrors BentoCanvas.displayNumberOf).
  const rows = useMemo(() => {
    const cellCounts = new Map<number, number>();
    for (const id of config.cells) {
      cellCounts.set(id, (cellCounts.get(id) ?? 0) + 1);
    }
    return getCompartmentReadingOrder(config)
      .filter((id) => drawnIds.has(id))
      .map((id, index) => {
        const rect = getCompartmentRect(config, id);
        return {
          id,
          number: index + 1,
          label: config.compartmentTexts?.[id] ?? '',
          rect,
          // A merged L, S or U has no width × depth to report; its bounding box
          // would name a rectangle it does not fill.
          cellCount: cellCounts.get(id) ?? 0,
          isRegion: rect !== null && (cellCounts.get(id) ?? 0) !== rect.w * rect.h,
        };
      })
      .filter((row): row is typeof row & { rect: CellRect } => row.rect !== null);
  }, [config, drawnIds]);

  const selectedRow = selectedId !== null ? rows.find((r) => r.id === selectedId) : undefined;

  // Only walls between two DRAWN compartments: a wall against background
  // pockets is one visual edge split across several pocket-pair segments, and
  // tilting one segment makes a jagged wall nobody asked for. (The sidebar
  // Angled Dividers panel still lists every pair for power users.)
  const selectedWalls = useMemo(
    () =>
      selectedId === null
        ? []
        : tilt.rows.filter(
            (row) =>
              (row.compartmentA === selectedId || row.compartmentB === selectedId) &&
              drawnIds.has(row.compartmentA) &&
              drawnIds.has(row.compartmentB)
          ),
    [tilt.rows, selectedId, drawnIds]
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveBentoDockCollapsed(next);
      return next;
    });
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 0);
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const handleMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current || !dockRef.current) return;
      const rightEdge = dockRef.current.getBoundingClientRect().right;
      const next = Math.max(
        BENTO_DOCK_MIN_WIDTH,
        Math.min(BENTO_DOCK_MAX_WIDTH, rightEdge - moveEvent.clientX)
      );
      setWidth(next);
    };

    const handleUp = () => {
      draggingRef.current = false;
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleUp);
      if (dockRef.current) {
        saveBentoDockWidth(dockRef.current.getBoundingClientRect().width);
      }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    // A cancelled gesture must also end the drag or draggingRef sticks true.
    document.addEventListener('pointercancel', handleUp);
  }, []);

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-shrink-0 flex-col items-center border-l border-stroke-subtle bg-surface-secondary py-2">
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={toggleCollapsed}
          className={ICON_BTN}
          aria-expanded={false}
          aria-label={t('binDesigner.bento.dockExpand')}
          title={t('binDesigner.bento.dockExpand')}
        >
          <Icon paths={ICON_PATHS.chevronDoubleLeft} />
        </IconButton>
        <span
          className="mt-3 text-micro font-semibold uppercase tracking-wider text-content-tertiary"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t('binDesigner.bento.dockTitle')}
        </span>
      </aside>
    );
  }

  return (
    <aside
      ref={dockRef}
      className="animate-fade-in relative flex flex-shrink-0 flex-col overflow-hidden border-l border-stroke-subtle bg-surface-secondary"
      style={{ width }}
      data-testid="bento-dock"
    >
      <div
        className="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize select-none"
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('binDesigner.bento.dockResize')}
        aria-valuenow={Math.round(width)}
        aria-valuemin={BENTO_DOCK_MIN_WIDTH}
        aria-valuemax={BENTO_DOCK_MAX_WIDTH}
      >
        <div className="absolute inset-y-0 left-1 w-px bg-transparent transition-colors group-hover:bg-accent/60" />
      </div>

      <div
        className={`flex flex-shrink-0 items-center gap-2 border-b border-stroke-subtle px-4 py-2 transition-shadow duration-200 ${
          isScrolled ? 'shadow-elevated' : ''
        }`}
      >
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={toggleCollapsed}
          className={ICON_BTN}
          aria-expanded
          aria-label={t('binDesigner.bento.dockCollapse')}
          title={t('binDesigner.bento.dockCollapse')}
        >
          <Icon paths={ICON_PATHS.chevronDoubleRight} />
        </IconButton>
        <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
          {t('binDesigner.bento.dockTitle')}
        </span>
        {selectedRow && (
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              touchTarget={false}
              onClick={() => onDuplicate(selectedRow.id)}
              className={ICON_BTN}
              aria-label={t('binDesigner.bento.duplicate')}
              title={t('binDesigner.bento.duplicate')}
            >
              <Icon paths={ICON_PATHS.duplicate} />
            </IconButton>
            <IconButton
              type="button"
              variant="dangerGhost"
              size="sm"
              touchTarget={false}
              onClick={() => onDelete(selectedRow.id)}
              className={`${ICON_BTN} hover:bg-error-muted hover:text-error`}
              aria-label={t('binDesigner.bento.delete')}
              title={t('binDesigner.bento.delete')}
            >
              <Icon paths={ICON_PATHS.trash} />
            </IconButton>
          </div>
        )}
      </div>

      <div
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin px-4 pb-3"
      >
        {/* Compartment list */}
        {rows.length === 0 ? (
          <p className="pt-3 text-xs leading-relaxed text-content-tertiary">
            {t('binDesigner.bento.dockEmptyHint')}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5 pt-2" aria-label={t('binDesigner.bento.dockTitle')}>
            {rows.map((row) => {
              const isSelected = row.id === selectedId;
              return (
                <li key={row.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    touchTarget={false}
                    onClick={() => onSelect(isSelected ? null : row.id)}
                    aria-pressed={isSelected}
                    data-testid={`bento-dock-row-${row.id}`}
                    className={`h-auto justify-start gap-2 rounded-md px-2 py-1.5 text-left text-xs font-normal transition-colors ${
                      isSelected
                        ? 'bg-accent/20 text-content-primary'
                        : 'text-content-secondary hover:bg-surface-hover'
                    }`}
                  >
                    <span className="w-5 flex-shrink-0 tabular-nums text-content-tertiary">
                      {row.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {row.label ||
                        t('binDesigner.bento.compartmentFallbackName', { number: row.number })}
                    </span>
                    <span className="flex-shrink-0 tabular-nums text-micro text-content-tertiary">
                      {t('binDesigner.bento.sizeMm', {
                        w: Math.round(row.rect.w * cellWmm),
                        d: Math.round(row.rect.h * cellHmm),
                      })}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Inspector for the selection */}
        {selectedRow && (
          <div className="mt-4 flex flex-col gap-4 border-t border-stroke-subtle pt-3">
            <div>
              <label className="mb-1 block text-micro font-semibold uppercase tracking-wider text-content-tertiary">
                {t('binDesigner.bento.labelField')}
              </label>
              {/* Full-width tabs print `label.rowTexts`, one caption per ROW,
                  so a per-compartment caption typed here would render nothing
                  (#2897). Disabled rather than hidden — the stored text is kept
                  and comes back when span is switched off. */}
              {labelSpan ? (
                <p className="text-micro leading-relaxed text-content-tertiary">
                  {t('binDesigner.bento.labelSpanDisabled')}
                </p>
              ) : (
                <>
                  <CompartmentTextInput
                    committedValue={selectedRow.label}
                    compartmentId={selectedRow.id}
                    placeholder={t('binDesigner.bento.labelPlaceholder')}
                    ariaLabel={t('binDesigner.bento.labelField')}
                    onCommit={onCommitLabel}
                    focusToken={labelFocusToken}
                  />
                  {!labelEnabled && (
                    <p className="mt-1 text-micro leading-relaxed text-content-tertiary">
                      {t('binDesigner.bento.labelTabsAuto')}
                    </p>
                  )}
                </>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-content-tertiary">{t('binDesigner.bento.sizeReadout')}</dt>
              <dd className="tabular-nums text-content-secondary">
                {selectedRow.isRegion
                  ? t('binDesigner.bento.sizeMerged')
                  : t('binDesigner.bento.sizeMm', {
                      w: Math.round(selectedRow.rect.w * cellWmm),
                      d: Math.round(selectedRow.rect.h * cellHmm),
                    })}
              </dd>
              <dt className="text-content-tertiary">{t('binDesigner.bento.cellsReadout')}</dt>
              <dd className="tabular-nums text-content-secondary">
                {selectedRow.isRegion
                  ? selectedRow.cellCount
                  : `${selectedRow.rect.w} × ${selectedRow.rect.h}`}
              </dd>
            </dl>

            <BentoCompartmentColorControls compartmentId={selectedRow.id} />

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onStash(selectedRow.id)}
              className="self-start"
            >
              {t('binDesigner.bento.stashAction')}
            </Button>

            {/* Wall shift/angle — the canvas shows the result, this edits it */}
            <div className="flex flex-col gap-3">
              <span className="text-micro font-semibold uppercase tracking-wider text-content-tertiary">
                {t('binDesigner.bento.wallsTitle')}
              </span>
              {selectedWalls.length === 0 ? (
                <p className="text-micro leading-relaxed text-content-tertiary">
                  {t('binDesigner.bento.wallsEmptyHint')}
                </p>
              ) : (
                selectedWalls.map((wall) => {
                  const other =
                    wall.compartmentA === selectedRow.id ? wall.compartmentB : wall.compartmentA;
                  const otherRow = rows.find((r) => r.id === other);
                  const otherName =
                    otherRow?.label ||
                    t('binDesigner.bento.compartmentFallbackName', {
                      number: otherRow?.number ?? 0,
                    });
                  return (
                    <div key={wall.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-content-secondary">
                          {t(
                            wall.axis === 'vertical'
                              ? 'binDesigner.bento.wallWithVertical'
                              : 'binDesigner.bento.wallWithHorizontal',
                            { name: otherName }
                          )}
                        </span>
                        {wall.hasTilt && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => tilt.handlers.resetRow(wall)}
                            className="h-auto px-1.5 py-0.5 text-micro text-accent hover:bg-transparent hover:text-accent/80"
                          >
                            {t('common.reset')}
                          </Button>
                        )}
                      </div>
                      {wall.geometry ? (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-0.5 text-micro text-content-tertiary">
                            {t('binDesigner.bento.wallShift')}
                            <Stepper
                              value={wall.shiftMm}
                              onChange={(next: number) =>
                                tilt.handlers.commitTilt(wall, {
                                  angleDeg: wall.angleDeg,
                                  shiftMm: next,
                                  leanDeg: wall.leanDeg,
                                })
                              }
                              onStep={(delta: number) =>
                                tilt.handlers.commitTilt(wall, {
                                  angleDeg: wall.angleDeg,
                                  shiftMm: wall.shiftMm + delta,
                                  leanDeg: wall.leanDeg,
                                })
                              }
                              min={wall.geometry.offsetMin}
                              max={wall.geometry.offsetMax}
                              step={SHIFT_UI_STEP_MM}
                              size="sm"
                              aria-label={t('binDesigner.bento.wallShift')}
                            />
                          </label>
                          <label className="flex flex-col gap-0.5 text-micro text-content-tertiary">
                            {t('binDesigner.bento.wallAngle')}
                            <Stepper
                              value={wall.angleDeg}
                              onChange={(next: number) =>
                                tilt.handlers.commitTilt(wall, {
                                  angleDeg: next,
                                  shiftMm: wall.shiftMm,
                                  leanDeg: wall.leanDeg,
                                })
                              }
                              onStep={(delta: number) =>
                                tilt.handlers.commitTilt(wall, {
                                  angleDeg: wall.angleDeg + delta,
                                  shiftMm: wall.shiftMm,
                                  leanDeg: wall.leanDeg,
                                })
                              }
                              min={-ANGLE_UI_MAX_DEG}
                              max={ANGLE_UI_MAX_DEG}
                              step={ANGLE_UI_STEP_DEG}
                              size="sm"
                              aria-label={t('binDesigner.bento.wallAngle')}
                            />
                          </label>
                        </div>
                      ) : (
                        <p className="text-micro text-content-tertiary">
                          {t('binDesigner.bento.wallTooSmall')}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <BentoBinWideSection />
      </div>
    </aside>
  );
}
