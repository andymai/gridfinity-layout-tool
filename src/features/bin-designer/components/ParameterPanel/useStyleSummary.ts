import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';

/** Colors state for the Style rail tooltip; undefined while colors are off. */
export function useStyleSummary(): string | undefined {
  const t = useTranslation();
  const colorsEnabled = useDesignerStore((s) => s.params.featureColors.enabled);
  return colorsEnabled ? t('binDesigner.group.colors') : undefined;
}
