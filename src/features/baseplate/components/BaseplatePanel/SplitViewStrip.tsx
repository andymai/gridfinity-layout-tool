/**
 * Non-collapsible inline strip showing the split-baseplate piece mini-map, and
 * the editor for user-drawn split lines.
 *
 * The map is proportional in MILLIMETRES, not units: padding is mm carried by
 * the outermost pieces only, so a padded plate's first and last tracks are
 * genuinely wider than the rest. Sizing tracks by unit span drew them equal and
 * put every seam at the wrong fraction of the plate (`splitMapLayout`).
 *
 * The aspect-fitted box is also the positioning context for the ruler ticks and
 * the drawn seams. It has to be: `aspect-ratio` transfers a height cap into a
 * width cap, so the map shrinks inside its grid area, and anything positioned
 * as a percentage of the AREA instead lands wide of the track it marks.
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
import { seamFraction, splitMapLayout } from '../../utils/splitMapLayout';
import type { BaseplateTiling, PaddingReductionHint } from '../../types/tiling';

/** Seam offsets are half-unit-quantized; this only absorbs float drift. */
const SEAM_EPSILON = 1e-6;

/** Tallest the map may be, in rem — the width cap is derived from it. */
const MAP_MAX_HEIGHT_REM = 14;

/**
 * How lopsided the map's own box may get. The tracks and seams stay true to the
 * plate either way (they are fractions of the box, whatever its shape); this
 * only stops a 20:1 plate rendering as an unreadable sliver, or as a strip so
 * tall it pushes the rest of the panel off screen.
 */
const MAP_MAX_ASPECT = 6;

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
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
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
  gridUnitMm,
  gridUnitMmY,
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

  const map = splitMapLayout(tiling, gridUnitMm, gridUnitMmY);
  const leftPercent = (offset: number): string =>
    `${seamFraction(offset, gridUnitMm, map.padLeftMm, map.widthMm) * 100}%`;
  const bottomPercent = (offset: number): string =>
    `${seamFraction(offset, gridUnitMmY, map.padFrontMm, map.depthMm) * 100}%`;

  // One box, shared by the map, both rulers and the seam overlay, so a
  // percentage means the same place in all four.
  const aspect = Math.min(MAP_MAX_ASPECT, Math.max(1 / MAP_MAX_ASPECT, map.widthMm / map.depthMm));
  const mapBoxStyle = { width: `min(100%, ${MAP_MAX_HEIGHT_REM * aspect}rem)` } as const;

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
        <span className="text-label text-content-tertiary whitespace-nowrap">
          {tiling.isCustomSplit
            ? t('baseplate.splitCustom')
            : t('baseplate.splitReason', { printBed: printBedSize })}
        </span>
      </div>

      <div className="px-4 pb-1">
        <span className="text-label text-content-secondary">
          {t(tiling.bedLoads === 1 ? 'baseplate.bedLoads.one' : 'baseplate.bedLoads.other', {
            count: tiling.bedLoads,
          })}
        </span>
      </div>

      {tiling.paddingReductionHint && (
        <div className="mx-4 mb-2 rounded bg-accent/10 px-2.5 py-1.5 text-label text-accent">
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
          className="mx-4 mb-2 rounded bg-danger/10 px-2.5 py-1.5 text-label text-danger"
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

        <div className="relative h-3" style={mapBoxStyle}>
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
                style={{ left: leftPercent(offset) }}
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
                style={{ bottom: bottomPercent(offset) }}
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

        <div
          className="relative"
          aria-label={t('baseplate.sectionView')}
          // The aspect ratio lives HERE, on the box the ruler ticks and the seam
          // overlay measure against, not on the grid inside it. On the grid it
          // transferred the height cap into a width cap, leaving the map
          // narrower than its own positioning context — which is what put the
          // drawn seams a whole column away from the tracks they mark.
          style={{ ...mapBoxStyle, aspectRatio: `${aspect}` }}
        >
          <div
            // No gap: the ruler ticks and the drawn seam lines are positioned as
            // a percentage of this same box, so any gutter would offset every
            // line from the boundary it marks.
            className="grid h-full w-full"
            style={{
              gridTemplateColumns: map.colMm.map((mm) => `${mm}fr`).join(' '),
              // Row 1 is the front of the plate, which reads as the BOTTOM of a
              // top-down map — so the tracks are emitted back-to-front and each
              // piece is placed by explicit row index rather than in DOM order.
              gridTemplateRows: [...map.rowMm]
                .reverse()
                .map((mm) => `${mm}fr`)
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
                    className={`flex !h-auto items-center justify-center overflow-hidden rounded-none border !px-0 !py-0 font-mono text-micro font-normal transition-shadow ${
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
                style={{ left: leftPercent(offset) }}
              />
            ))}
            {rowSeams.map((offset) => (
              <span
                key={`line-row-${offset}`}
                className="absolute right-0 left-0 h-0.5 translate-y-1/2 rounded-full bg-accent"
                style={{ bottom: bottomPercent(offset) }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 px-4 pb-3">
        <span className="text-label text-content-tertiary">{t('baseplate.splitEditHint')}</span>
        {tiling.isCustomSplit && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="!px-1 text-label"
            onClick={() => onChangeSplit(undefined)}
          >
            {t('baseplate.splitResetAuto')}
          </Button>
        )}
      </div>
    </div>
  );
}
