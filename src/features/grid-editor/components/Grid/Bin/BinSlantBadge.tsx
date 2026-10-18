import { useTranslation } from '@/i18n';
import { BinBadge } from './BinBadge';
import { ICON_PATHS } from './binConstants';

/** Marks a slanted bin whose row needs attention; the inspector says what. */
export function BinSlantBadge({ small }: { small: boolean }) {
  const t = useTranslation();
  const label = t('grid.bin.slantIssue');
  return (
    <div title={label}>
      <BinBadge small={small} label={label} path={ICON_PATHS.warning} colorClass="text-warning" />
    </div>
  );
}
