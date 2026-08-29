/**
 * First-run canvas state for a pristine 1×1 grid, where "drag to draw" has
 * nothing to draw on. Offers bin-size-derived grid resolutions as one-click
 * choices instead of silently regridding: changing the grid changes the
 * printed bin (every cell is a pocket), so it must be the user's action —
 * just a cheap one.
 */

import { useMemo } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { validateCompartmentSizes } from '@/features/bin-designer/utils/validation';

export interface BentoGridSetupProps {
  /** Bin footprint in grid units. */
  readonly width: number;
  readonly depth: number;
  readonly wallThickness: number;
  readonly compartmentThickness: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY?: number;
  /** Interior mm, for the per-cell size captions. */
  readonly interiorW: number;
  readonly interiorD: number;
  readonly onPick: (cols: number, rows: number) => void;
}

interface GridOption {
  readonly cols: number;
  readonly rows: number;
  readonly cellW: number;
  readonly cellH: number;
}

export function BentoGridSetup({
  width,
  depth,
  wallThickness,
  compartmentThickness,
  gridUnitMm,
  gridUnitMmY,
  interiorW,
  interiorD,
  onPick,
}: BentoGridSetupProps) {
  const t = useTranslation();

  const options = useMemo((): GridOption[] => {
    const clampDim = (v: number): number =>
      Math.min(DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID, Math.max(1, Math.round(v)));
    const seen = new Set<string>();
    const out: GridOption[] = [];
    // Whole-unit, half-unit and third-unit cells, coarsest first. Half-unit
    // (≈21mm) is the sweet spot for most bins; thirds give drawer-organizer
    // granularity on small bins before the 12-cell ceiling cuts in.
    for (const perUnit of [1, 2, 3]) {
      const cols = clampDim(width * perUnit);
      const rows = clampDim(depth * perUnit);
      if (cols === 1 && rows === 1) continue;
      const key = `${cols}x${rows}`;
      if (seen.has(key)) continue;
      const valid = isOk(
        validateCompartmentSizes(
          width,
          depth,
          wallThickness,
          cols,
          rows,
          compartmentThickness,
          gridUnitMm,
          gridUnitMmY
        )
      );
      if (!valid) continue;
      seen.add(key);
      out.push({ cols, rows, cellW: interiorW / cols, cellH: interiorD / rows });
    }
    return out;
  }, [
    width,
    depth,
    wallThickness,
    compartmentThickness,
    gridUnitMm,
    gridUnitMmY,
    interiorW,
    interiorD,
  ]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div
        className="pointer-events-auto flex max-w-sm flex-col gap-3 rounded-xl border border-stroke-subtle bg-surface-elevated p-4 shadow-lg"
        data-testid="bento-grid-setup"
        // The card sits inside the canvas container, whose pointerdown starts
        // a draw — without this, picking a grid also draws a stray 1×1.
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-sm font-semibold text-content-primary">
            {t('binDesigner.bento.gridSetupTitle')}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
            {t('binDesigner.bento.gridSetupSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={`${option.cols}x${option.rows}`}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onPick(option.cols, option.rows)}
              className="h-auto flex-col items-start gap-0.5 px-3 py-2"
            >
              <span className="text-xs font-semibold tabular-nums">
                {option.cols}×{option.rows}
              </span>
              <span className="text-micro font-normal tabular-nums text-content-tertiary">
                {t('binDesigner.bento.gridSetupCellSize', {
                  w: Math.round(option.cellW),
                  d: Math.round(option.cellH),
                })}
              </span>
            </Button>
          ))}
        </div>
        <p className="text-micro text-content-tertiary">
          {t('binDesigner.bento.gridSetupCustomHint')}
        </p>
      </div>
    </div>
  );
}
