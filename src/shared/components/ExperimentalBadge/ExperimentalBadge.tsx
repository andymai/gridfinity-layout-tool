/**
 * "Experimental" status chip. Single source of truth so every experimental
 * feature (e.g. multi-color export) reads identically. Built on the
 * design-system {@link Badge} with the shared info tone — the same word in
 * two tones reads as two different states, and every other Experimental
 * badge in the app is `info`.
 */

import { Badge } from '@/design-system';
import { useTranslation } from '@/i18n';

export function ExperimentalBadge() {
  const t = useTranslation();
  return <Badge tone="info">{t('settings.experimental')}</Badge>;
}
