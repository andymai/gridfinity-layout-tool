/**
 * Non-collapsible inline strip showing the split-baseplate piece mini-map.
 * Each cell is a hoverable/selectable button corresponding to one print-bed piece.
 */

import { useTranslation } from '@/i18n';
import { colToLetter } from '../../utils/splitPlanner';
import type { BaseplateTiling, PaddingReductionHint } from '../../types/tiling';

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
}

export function SplitViewStrip({
  tiling,
  hoveredPieceLabel,
  selectedPieceLabel,
  onHoverPiece,
  onSelectPiece,
  printBedSize,
}: SplitViewStripProps) {
  const t = useTranslation();

  return (
    <div className="border-b border-stroke-subtle">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-1">
        <span className="text-xs text-content-secondary">
          {t('baseplate.splitInfo', { count: tiling.pieces.length })}
        </span>
        <span className="text-[11px] text-content-tertiary whitespace-nowrap">
          {t('baseplate.splitReason', { printBed: printBedSize })}
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

      <div className="px-4 pb-3">
        <div
          className="grid gap-1"
          aria-label={t('baseplate.sectionView')}
          style={{
            gridTemplateColumns: `repeat(${tiling.cols}, 1fr)`,
          }}
        >
          {Array.from({ length: tiling.rows }, (_, ri) => {
            // Flip Y so row 1 (front/bottom in 3D) is at the bottom of the mini-map
            const r = tiling.rows - 1 - ri;
            return Array.from({ length: tiling.cols }, (_, c) => {
              const label = `${colToLetter(c)}${r + 1}`;
              const isHovered = hoveredPieceLabel === label;
              const isSelected = selectedPieceLabel === label;
              return (
                <button
                  key={label}
                  type="button"
                  className={`flex items-center justify-center rounded border bg-surface-elevated py-1 text-[10px] font-mono transition-shadow ${
                    isSelected
                      ? 'ring-2 ring-accent border-accent text-content-primary'
                      : isHovered
                        ? 'ring-1 ring-accent/50 border-accent/50 text-content-secondary'
                        : 'border-stroke-subtle text-content-tertiary'
                  }`}
                  onPointerEnter={() => onHoverPiece(label)}
                  onPointerLeave={() => onHoverPiece(null)}
                  onClick={() => onSelectPiece(selectedPieceLabel === label ? null : label)}
                  aria-pressed={isSelected}
                  aria-label={t('baseplate.pieceLabel', { label })}
                >
                  {label}
                </button>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
