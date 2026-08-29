/**
 * Warns that the design's feet disagree with where its linked bin sits, offering
 * a one-click realign.
 *
 * `blocksSeating` distinguishes the two: a wrong fractional edge puts the half
 * foot on the wrong side, while a wrong foot lattice leaves the bin perched on
 * the ridges between pockets. The second is a part that does not fit, so it says
 * so rather than sharing the milder wording.
 */

import { Button } from '@/design-system';
import { AlertTriangleIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';

interface FractionalEdgeMismatchBannerProps {
  onMatchDrawer: () => void;
  /** True when the mismatch stops the bin dropping into a baseplate. */
  blocksSeating?: boolean;
}

export function FractionalEdgeMismatchBanner({
  onMatchDrawer,
  blocksSeating = false,
}: FractionalEdgeMismatchBannerProps) {
  const t = useTranslation();
  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning"
    >
      <AlertTriangleIcon size="sm" className="flex-shrink-0" aria-hidden="true" />
      <span className="flex-1">
        {t(
          blocksSeating ? 'binDesigner.footLatticeMismatch' : 'binDesigner.fractionalEdgeMismatch'
        )}
      </span>
      <Button type="button" variant="secondary" size="sm" onClick={onMatchDrawer}>
        {t('binDesigner.fractionalEdgeMatchDrawer')}
      </Button>
    </div>
  );
}
