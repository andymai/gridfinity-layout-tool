/**
 * Always-visible bin-size block at the top of the cutout inspector, so the bin
 * can be resized without leaving the editor. Reuses the main DimensionsSection
 * (self-wired to the designer store) and, when cutouts sit past the footprint,
 * surfaces a warning offering the two ways out: grow the board to them, or
 * clamp them back in.
 */

import type { GrowTarget } from '../panel/CutoutsSection/growBinToFit';
import { Alert, Button } from '@/design-system';
import { AlertTriangleIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { DimensionsSection } from '../panel/DimensionsSection/DimensionsSection';

/**
 * The dock narrows to 220px and the action names a bin size, so verbose locales
 * (it/uk/de and four others measure past the content box) need a second line.
 * `h-6` would clip it, so the button sizes to its content instead.
 */
const WRAPPING_ACTION = 'h-auto min-h-6 whitespace-normal py-1 leading-tight';

interface BinSizeSectionProps {
  /** Count of cutouts stranded past the board after a resize (0 = none). */
  readonly offBoardCount: number;
  /** Clamp every off-board cutout back inside the board. */
  readonly onClampOffBoard?: () => void;
  /**
   * Center every off-board cutout on the board as one block. Absent when
   * centering would not clear the warning, which is what keeps this from
   * duplicating the clamp: it is offered only for a shape that fits the board
   * and is merely sitting in the wrong place.
   */
  readonly onCenterOffBoard?: () => void;
  /**
   * Bin size that would fit every stray, or `null` when growing can't clear the
   * warning (past `MAX_DIMENSION`, a custom footprint, or a stray hanging past
   * the origin edge). `null` hides the action rather than growing partway, and
   * says so. `undefined` means growing is not the mechanism on this board at all
   * (the lid), where explaining that the bin can't grow far enough would be a
   * false reason for a shape that is simply lying on a magnet boss.
   */
  readonly growTarget?: GrowTarget | null;
  /** Resize the bin to {@link growTarget}. */
  readonly onGrowToFit?: () => void;
  /** Count of cutouts the generator will cut shallower than requested. */
  readonly depthShortfallCount?: number;
}

export function BinSizeSection({
  offBoardCount,
  onClampOffBoard,
  onCenterOffBoard,
  growTarget,
  onGrowToFit,
  depthShortfallCount = 0,
}: BinSizeSectionProps) {
  const t = useTranslation();
  return (
    <div className="space-y-3 border-b border-stroke-subtle pb-3 pt-3">
      <span className="block text-micro font-semibold uppercase tracking-wider text-content-tertiary">
        {t('binDesigner.cutoutEditor.binSize')}
      </span>

      <DimensionsSection />

      {offBoardCount > 0 && (
        // Alert carries role="alert", so the warning now announces when a cutout
        // is stranded; the hand-rolled box it replaces was silent.
        <Alert intent="error" icon={<AlertTriangleIcon size="xs" className="mt-0.5" />}>
          <p className="leading-snug text-error">
            {t(
              offBoardCount === 1
                ? 'binDesigner.cutoutEditor.offBoardWarning.one'
                : 'binDesigner.cutoutEditor.offBoardWarning.other',
              { count: offBoardCount }
            )}
          </p>
          {/* Reads as the reason the grow action is absent, so it belongs with
              the warning rather than below the buttons. */}
          {growTarget === null && (
            <p className="mt-1 leading-snug text-error/80">
              {t('binDesigner.cutoutEditor.growBinUnavailable')}
            </p>
          )}
          <div className="mt-2 space-y-2">
            {growTarget && onGrowToFit && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                fullWidth
                className={WRAPPING_ACTION}
                onClick={onGrowToFit}
              >
                {t('binDesigner.cutoutEditor.growBinToFit', {
                  width: growTarget.width,
                  depth: growTarget.depth,
                })}
              </Button>
            )}
            {/* Between the two: growing changes the part, centering and
                clamping both only move shapes, and centering is the gentler of
                those — it keeps the strays' arrangement instead of pinning
                them to an edge. */}
            {onCenterOffBoard && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                fullWidth
                className={WRAPPING_ACTION}
                onClick={onCenterOffBoard}
              >
                {t('binDesigner.cutouts.centerInBin')}
              </Button>
            )}
            {onClampOffBoard && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                fullWidth
                className={WRAPPING_ACTION}
                onClick={onClampOffBoard}
              >
                {t('binDesigner.cutoutEditor.bringBackIn')}
              </Button>
            )}
          </div>
        </Alert>
      )}

      {depthShortfallCount > 0 && (
        // Warning, not error: the bin still generates, just shallower than the
        // number in the inspector. Selecting the cutout shows the exact depths.
        <Alert intent="warning" icon={<AlertTriangleIcon size="xs" className="mt-0.5" />}>
          <p className="leading-snug text-warning">
            {t('binDesigner.cutoutEditor.depthShortfallWarning', {
              count: depthShortfallCount,
            })}
          </p>
        </Alert>
      )}
    </div>
  );
}
