import { useMemo } from 'react';
import { useLabsStore } from '@/core/store';
import { getFeature } from '@/core/labs';
import { Button } from '@/design-system';
import { SparklesIcon } from '../icons';
import { useTranslation } from '@/i18n';

export function LabsButton() {
  const t = useTranslation();
  const openDrawer = useLabsStore((state) => state.openDrawer);
  const enabledFeatures = useLabsStore((state) => state.preferences.enabledFeatures);

  const enabledCount = useMemo(() => {
    return Object.entries(enabledFeatures).filter(([id, enabled]) => {
      if (!enabled) return false;
      const feature = getFeature(id);
      return feature?.status === 'experimental' || feature?.status === 'preview';
    }).length;
  }, [enabledFeatures]);

  return (
    <Button
      variant="ghost"
      fullWidth
      onClick={openDrawer}
      className="justify-start gap-2 px-3 py-2 font-normal text-content-secondary"
      aria-label={`Open Labs experimental features${enabledCount > 0 ? `, ${enabledCount} enabled` : ''}`}
    >
      <SparklesIcon className="w-[18px] h-[18px] flex-shrink-0" />
      <div className="flex-1 text-left">
        <div className="text-sm font-medium">{t('labs.labs')}</div>
        <div className="text-[11px] text-content-tertiary">{t('labs.tryExperimentalFeatures')}</div>
      </div>
      {enabledCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold text-on-dark bg-accent rounded-full">
          {enabledCount > 9 ? t('common.overflowCount') : enabledCount}
        </span>
      )}
    </Button>
  );
}
