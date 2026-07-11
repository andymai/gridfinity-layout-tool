/**
 * Warns that the design's half-unit foot sits on a different edge than the
 * linked drawer's fractional slot, offering a one-click realign (issue #2518).
 */

import { Button } from '@/design-system';
import { AlertTriangleIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';

interface FractionalEdgeMismatchBannerProps {
  onMatchDrawer: () => void;
}

export function FractionalEdgeMismatchBanner({ onMatchDrawer }: FractionalEdgeMismatchBannerProps) {
  const t = useTranslation();
  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-status-warning/20 bg-status-warning/10 px-4 py-2 text-xs text-status-warning"
    >
      <AlertTriangleIcon size="sm" className="flex-shrink-0" aria-hidden="true" />
      <span className="flex-1">{t('binDesigner.fractionalEdgeMismatch')}</span>
      <Button type="button" variant="secondary" size="sm" onClick={onMatchDrawer}>
        {t('binDesigner.fractionalEdgeMatchDrawer')}
      </Button>
    </div>
  );
}
