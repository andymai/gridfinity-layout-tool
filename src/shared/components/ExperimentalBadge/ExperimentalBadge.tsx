import { Badge } from '@/design-system';
import { useTranslation } from '@/i18n';

export function ExperimentalBadge() {
  const t = useTranslation();
  return <Badge tone="info">{t('settings.experimental')}</Badge>;
}
