import { getStaticTranslation } from '@/i18n';
import { CONSTRAINTS } from '@/core/constants';

export function layoutCopyName(name: string): string {
  return getStaticTranslation('layouts.copyName', { name }).slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
}
