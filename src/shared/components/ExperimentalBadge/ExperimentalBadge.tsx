/**
 * "Experimental" status chip. Single source of truth so every experimental
 * feature (multi-color, design links, vertical stack, …) reads identically.
 * Built on the design-system {@link Badge} with the shared warning tone.
 */

import { Badge } from '@/design-system';
import { useTranslation } from '@/i18n';

export function ExperimentalBadge() {
  const t = useTranslation();
  return <Badge tone="warning">{t('settings.experimental')}</Badge>;
}
