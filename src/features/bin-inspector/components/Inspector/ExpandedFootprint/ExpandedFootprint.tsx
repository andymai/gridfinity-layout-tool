/**
 * Readout for a bin carrying an explicit per-placement overhang.
 *
 * Leads with the outer size in mm because that is the number the user was
 * chasing — a bin exists at 98mm because 84mm won't take a sleeved card. The
 * per-side values are diagnostic, so they sit underneath in smaller text.
 *
 * Read-only by design: "Expand to Fit" is the only thing that authors these
 * values, and per-side editing here would make it easy to author bodies that
 * overlap while footprint validation still reads as legal. Reset is the escape
 * hatch, and it exists so clearing doesn't depend on undo still being in range.
 *
 * Renders nothing for a bin whose extension comes from the drawer margin — that
 * is derived live from baseplate padding and owned by `ExtendToMarginToggle`.
 */

import { Button } from '@/design-system';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { useTranslation } from '@/i18n';
import { effectiveGridUnitMmY } from '@/core/types';
import type { Bin, Layout } from '@/core/types';
import { formatMm } from '@/shared/utils/format';

interface ExpandedFootprintProps {
  bin: Bin;
  layout: Layout;
}

/** Signed mm for a per-side value, so `+0` reads as "not extended here". */
function formatSide(value: number): string {
  return `+${formatMm(value)}`;
}

export function ExpandedFootprint({ bin, layout }: ExpandedFootprintProps) {
  const t = useTranslation();
  const { updateBin } = useMutations();

  const overhang = bin.overhang;
  if (!overhang) return null;
  if (overhang.enabled === false) return null;

  const { left, right, front, back } = overhang;
  if (left + right + front + back <= 0) return null;

  const outerW = bin.width * layout.gridUnitMm + left + right;
  const outerD = bin.depth * effectiveGridUnitMmY(layout) + front + back;

  return (
    <div className="rounded-md border border-subtle p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-content-tertiary">
            {t('inspector.expandedFootprint')}
          </p>
          <p className="text-sm text-content-primary">
            {formatMm(outerW)} × {formatMm(outerD)} mm
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => updateBin(bin.id, { overhang: null })}
        >
          {t('common.reset')}
        </Button>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-content-tertiary">
        {t('inspector.expandedFootprint.sides', {
          left: formatSide(left),
          right: formatSide(right),
          front: formatSide(front),
          back: formatSide(back),
        })}
      </p>
    </div>
  );
}
