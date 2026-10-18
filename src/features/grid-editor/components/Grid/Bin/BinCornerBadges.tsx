import type { SlantSide } from '@/core/types';
import { useTranslation } from '@/i18n';
import { BinBadge } from './BinBadge';
import { BinSlantBadge } from './BinSlantBadge';
import { ICON_PATHS } from './binConstants';

interface BinCornerBadgesProps {
  small: boolean;
  locked: boolean;
  slantSide: SlantSide | null | undefined;
  slantAttention: boolean;
}

export function BinCornerBadges({
  small,
  locked,
  slantSide,
  slantAttention,
}: BinCornerBadgesProps) {
  const t = useTranslation();
  if (!locked && !slantSide) return null;
  return (
    <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 pointer-events-none">
      {locked && (
        <div title={t('grid.sizeLocked')}>
          <BinBadge small={small} label={t('grid.sizeLocked')} path={ICON_PATHS.lock} />
        </div>
      )}
      {slantSide && <BinSlantBadge small={small} side={slantSide} attention={slantAttention} />}
    </div>
  );
}
