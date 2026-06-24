/**
 * Always-visible bin-size block at the top of the cutout inspector, so the bin
 * can be resized without leaving the editor. Reuses the main DimensionsSection
 * (self-wired to the designer store) and, when a resize strands cutouts past
 * the new footprint, surfaces a warning with a one-click clamp-back action.
 */

import { Button } from '@/design-system';
import { AlertTriangleIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { DimensionsSection } from '../panel/DimensionsSection/DimensionsSection';

interface BinSizeSectionProps {
  /** Count of cutouts stranded past the board after a resize (0 = none). */
  readonly offBoardCount: number;
  /** Clamp every off-board cutout back inside the board. */
  readonly onClampOffBoard?: () => void;
}

export function BinSizeSection({ offBoardCount, onClampOffBoard }: BinSizeSectionProps) {
  const t = useTranslation();
  return (
    <div className="space-y-3 border-b border-stroke-subtle pb-3 pt-3">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
        {t('binDesigner.cutoutEditor.binSize')}
      </span>

      <DimensionsSection />

      {offBoardCount > 0 && (
        <div className="space-y-2 rounded-md border border-error/40 bg-error-muted p-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangleIcon size="xs" className="mt-0.5 shrink-0 text-error" />
            <span className="text-[11px] leading-snug text-error">
              {t('binDesigner.cutoutEditor.offBoardWarning', { count: offBoardCount })}
            </span>
          </div>
          {onClampOffBoard && (
            <Button type="button" variant="secondary" size="sm" fullWidth onClick={onClampOffBoard}>
              {t('binDesigner.cutoutEditor.bringBackIn')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
