/**
 * Non-collapsible inline strip showing the split-baseplate piece mini-map, and
 * the editor for user-drawn split lines (issue #3115).
 *
 * The map is proportional: each piece region's grid track is sized by its real
 * unit span, so the mini-map reads as the plate rather than as a uniform table.
 *
 * Cuts are placed from two rulers flanking the map (one tick per legal offset)
 * rather than from lanes drawn across it. Crossing sets of full-span hit
 * targets contend at every intersection — whichever renders last wins, which
 * left half of one axis's controls unclickable — so the map itself carries only
 * a `pointer-events-none` overlay showing where the seams land. There are at
 * most (width - 1) + (depth - 1) ticks, versus one control per grid cell, which
 * keeps a 50x50 plate to ~98 controls instead of 2500.
 *
 * Clicking any tick switches the plate to a custom plan seeded from whatever
 * the planner last produced, so hand-editing always starts from the automatic
 * answer rather than from a blank plate.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { FractionalEdge, SplitOverride } from '@/core/types';
import { colToLetter } from '../../utils/splitPlanner';
import {
  chunksToSeams,
  seamPositions,
  splitOverrideFromSeams,
  toggleSeam,
} from '../../utils/splitOverride';
import type { BaseplateTiling, PaddingReductionHint } from '../../types/tiling';

/** Seam offsets are half-unit-quantized; this only absorbs float drift. */
const SEAM_EPSILON = 1e-6;

const PADDING_HINT_AXIS_KEYS: Record<PaddingReductionHint['axis'], string> = {
  x: 'baseplate.paddingHintAxisX',
  y: 'baseplate.paddingHintAxisY',
  both: 'baseplate.paddingHintAxisBoth',
};

interface SplitViewStripProps {
  readonly tiling: BaseplateTiling;
  readonly hoveredPieceLabel: string | null;
  readonly selectedPieceLabel: string | null;
  readonly onHoverPiece: (label: string | null) => void;
  readonly onSelectPiece: (label: string | null) => void;
  readonly printBedSize: number;
  readonly fractionalEdgeX: FractionalEdge;
  readonly fractionalEdgeY: FractionalEdge;
  readonly onChangeSplit: (override: SplitOverride | undefined) => void;
}

export function SplitViewStrip({
  tiling,
  hoveredPieceLabel,
  selectedPieceLabel,
  onHoverPiece,
  onSelectPiece,
  printBedSize,
  fractionalEdgeX,
  fractionalEdgeY,
  onChangeSplit,
}: SplitViewStripProps) {
  const t = useTranslation();

  const { totalWidthUnits, totalDepthUnits, colSizes, rowSizes } = tiling;
  const colSeams = chunksToSeams(colSizes);
  const rowSeams = chunksToSeams(rowSizes);
  const colLanes = seamPositions(totalWidthUnits, fractionalEdgeX);
  const rowLanes = seamPositions(totalDepthUnits, fractionalEdgeY);

  const overageByLabel = new Map(tiling.bedOverages.map((o) => [o.label, o]));
  // Set, not a `pieces.some()` per cell: the map renders cols x rows cells and a
  // scan per cell is O(cols*rows*pieces) on every hover — ~6M checks on a 50x50.
  const presentLabels = new Set(tiling.pieces.map((p) => p.label));

  const applySeams = (nextCols: readonly number[], nextRows: readonly number[]): void => {
    onChangeSplit(splitOverrideFromSeams(nextCols, nextRows, totalWidthUnits, totalDepthUnits));
  };

  return (
    <div className="border-b border-stroke-subtle">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-1">
        <span className="text-xs text-content-secondary">
          {/* A custom plan can merge the plate back down to a single piece, a
              state the automatic path never rendered this strip in. */}
          {t(tiling.pieces.length === 1 ? 'baseplate.splitInfo.one' : 'baseplate.splitInfo.other', {
            count: tiling.pieces.length,
          })}
        </span>
        <span className="text-[11px] text-content-tertiary whitespace-nowrap">
          {tiling.isCustomSplit
            ? t('baseplate.splitCustom')
            : t('baseplate.splitReason', { printBed: printBedSize })}
        </span>
      </div>

      <div className="px-4 pb-1">
        <span className="text-[11px] text-content-secondary">
          {t(tiling.bedLoads === 1 ? 'baseplate.bedLoads.one' : 'baseplate.bedLoads.other', {
            count: tiling.bedLoads,
          })}
        </span>
      </div>

      {tiling.paddingReductionHint && (
        <div className="mx-4 mb-2 rounded bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent">
          {t('baseplate.paddingHint', {
            axis: t(PADDING_HINT_AXIS_KEYS[tiling.paddingReductionHint.axis]),
            mm: tiling.paddingReductionHint.reductionMm,
            count: tiling.paddingReductionHint.piecesSaved,
          })}
        </div>
      )}

      {tiling.bedOverages.length > 0 && (
        <div
          role="alert"
          className="mx-4 mb-2 rounded bg-danger/10 px-2.5 py-1.5 text-[11px] text-danger"
        >
          {t('baseplate.splitOverBed', {
            pieces: tiling.bedOverages.map((o) => o.label).join(', '),
            mm: Math.ceil(
              Math.max(...tiling.bedOverages.map((o) => Math.max(o.overWidthMm, o.overDepthMm)))
            ),
          })}
        </div>
      )}

      {/* Seam controls live in rulers OUTSIDE the map, not as lanes over it.
          Two crossing sets of full-span hit targets fight for every click at
          their intersections — whichever renders last wins, so half of one
          axis's controls become unreachable. The lines still get drawn across
          the map, as a non-interactive overlay. */}
      <div className="grid grid-cols-[0.75rem_1fr] grid-rows-[0.75rem_1fr] gap-0.5 px-4 pb-2">
        <div aria-hidden="true" />

        <div className="relative h-3">
          {colLanes.map((offset) => {
            const active = colSeams.some((s) => Math.abs(s - offset) < SEAM_EPSILON);
            return (
              <Button
                key={`col-${offset}`}
                variant="ghost"
                type="button"
                touchTarget={false}
                className={`absolute top-0 !h-3 w-4 !min-w-0 -translate-x-1/2 rounded-none border-0 !px-0 !py-0 ${
                  active ? 'text-accent' : 'text-stroke-subtle hover:text-content-tertiary'
                }`}
                style={{ left: `${(offset / totalWidthUnits) * 100}%` }}
                onClick={() => applySeams(toggleSeam(colSeams, offset), rowSeams)}
                aria-pressed={active}
                aria-label={t('baseplate.splitSeamVertical', { position: offset })}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none block h-full w-0.5 rounded-full bg-current"
                />
              </Button>
            );
          })}
        </div>

        <div className="relative w-3">
          {rowLanes.map((offset) => {
            const active = rowSeams.some((s) => Math.abs(s - offset) < SEAM_EPSILON);
            return (
              <Button
                key={`row-${offset}`}
                variant="ghost"
                type="button"
                touchTarget={false}
                className={`absolute left-0 !h-4 w-3 !min-w-0 translate-y-1/2 rounded-none border-0 !px-0 !py-0 ${
                  active ? 'text-accent' : 'text-stroke-subtle hover:text-content-tertiary'
                }`}
                // Offsets measure from the plate FRONT while the map draws front
                // at the bottom, so the tick is positioned from the bottom edge.
                style={{ bottom: `${(offset / totalDepthUnits) * 100}%` }}
                onClick={() => applySeams(colSeams, toggleSeam(rowSeams, offset))}
                aria-pressed={active}
                aria-label={t('baseplate.splitSeamHorizontal', { position: offset })}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none block h-0.5 w-full rounded-full bg-current"
                />
              </Button>
            );
          })}
        </div>

        <div className="relative" aria-label={t('baseplate.sectionView')}>
          <div
            // No gap: the ruler ticks and the drawn seam lines are positioned as
            // a percentage of this same box, so any gutter would offset every
            // line from the boundary it marks.
            className="grid max-h-56 min-h-16"
            style={{
              // `fr` rows only distribute proportionally against a definite
              // height, which an auto-height grid does not have — without this
              // every row would collapse to its content and a 1-unit row would
              // look the same as a 6-unit one.
              aspectRatio: `${totalWidthUnits} / ${totalDepthUnits}`,
              gridTemplateColumns: colSizes.map((s) => `${s}fr`).join(' '),
              // Row 1 is the front of the plate, which reads as the BOTTOM of a
              // top-down map — so the tracks are emitted back-to-front and each
              // piece is placed by explicit row index rather than in DOM order.
              gridTemplateRows: [...rowSizes]
                .reverse()
                .map((s) => `${s}fr`)
                .join(' '),
            }}
          >
            {rowSizes.map((_, r) =>
              colSizes.map((__, c) => {
                const label = `${colToLetter(c)}${r + 1}`;
                const isHovered = hoveredPieceLabel === label;
                const isSelected = selectedPieceLabel === label;
                const overage = overageByLabel.get(label);
                // Pieces the perimeter dropped leave a gap, which is how the
                // mini-map reads as the plate's shape (matching the labels'
                // positional numbering in the print guide).
                if (!presentLabels.has(label)) {
                  return (
                    <div
                      key={label}
                      style={{ gridColumn: c + 1, gridRow: rowSizes.length - r }}
                      aria-hidden="true"
                    />
                  );
                }
                return (
                  <Button
                    key={label}
                    variant="ghost"
                    type="button"
                    touchTarget={false}
                    style={{ gridColumn: c + 1, gridRow: rowSizes.length - r }}
                    className={`flex !h-auto items-center justify-center overflow-hidden rounded-none border !px-0 !py-0 font-mono text-[10px] font-normal transition-shadow ${
                      overage
                        ? 'border-danger bg-danger/10 text-danger ring-1 ring-danger'
                        : isSelected
                          ? 'border-accent bg-surface-elevated text-content-primary ring-2 ring-accent'
                          : isHovered
                            ? 'border-accent/50 bg-surface-elevated text-content-secondary ring-1 ring-accent/50'
                            : 'border-stroke-subtle bg-surface-elevated text-content-tertiary'
                    }`}
                    onPointerEnter={() => onHoverPiece(label)}
                    onPointerLeave={() => onHoverPiece(null)}
                    onClick={() => onSelectPiece(selectedPieceLabel === label ? null : label)}
                    aria-pressed={isSelected}
                    aria-label={
                      overage
                        ? t('baseplate.pieceLabelOverBed', { label })
                        : t('baseplate.pieceLabel', { label })
                    }
                  >
                    {label}
                  </Button>
                );
              })
            )}
          </div>

          {/* Purely decorative: the seams the ruler ticks control, drawn where
              they actually fall on the plate. */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {colSeams.map((offset) => (
              <span
                key={`line-col-${offset}`}
                className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-accent"
                style={{ left: `${(offset / totalWidthUnits) * 100}%` }}
              />
            ))}
            {rowSeams.map((offset) => (
              <span
                key={`line-row-${offset}`}
                className="absolute right-0 left-0 h-0.5 translate-y-1/2 rounded-full bg-accent"
                style={{ bottom: `${(offset / totalDepthUnits) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 px-4 pb-3">
        <span className="text-[11px] text-content-tertiary">{t('baseplate.splitEditHint')}</span>
        {tiling.isCustomSplit && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="!px-1 text-[11px]"
            onClick={() => onChangeSplit(undefined)}
          >
            {t('baseplate.splitResetAuto')}
          </Button>
        )}
      </div>
    </div>
  );
}
