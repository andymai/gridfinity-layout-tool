import type { SlantSide } from '@/core/types';
import { useTranslation } from '@/i18n';
import { BinBadge } from './BinBadge';
import { ICON_PATHS } from './binConstants';

/** Screen orientation: back (+Y) is up. */
const TURN_DEG: Record<SlantSide, number> = { back: 0, right: 90, front: 180, left: 270 };

/**
 * Points the way a slanted bin leans, and turns to a warning when its row
 * needs attention; the inspector says what.
 */
export function BinSlantBadge({
  small,
  side,
  attention,
}: {
  small: boolean;
  side: SlantSide;
  attention: boolean;
}) {
  const t = useTranslation();
  const label = attention ? t('grid.bin.slantIssue') : t('binDesigner.slant.title');
  return (
    <div
      title={label}
      style={attention ? undefined : { transform: `rotate(${TURN_DEG[side]}deg)` }}
    >
      <BinBadge
        small={small}
        label={label}
        path={attention ? ICON_PATHS.warning : ICON_PATHS.lean}
        colorClass={attention ? 'text-warning' : 'text-content-tertiary'}
      />
    </div>
  );
}
