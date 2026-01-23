import { useMemo } from 'react';
import { useLabsStore } from '@/core/store';
import { getFeature } from '@/core/labs';
import { SparklesIcon } from './icons';

export function LabsButton() {
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
    <button
      onClick={openDrawer}
      className="flex items-center gap-2 w-full px-3 py-2 text-content-secondary hover:text-content hover:bg-surface-hover rounded-md transition-colors"
      aria-label={`Open Labs experimental features${enabledCount > 0 ? `, ${enabledCount} enabled` : ''}`}
    >
      <SparklesIcon className="w-[18px] h-[18px] flex-shrink-0" />
      <div className="flex-1 text-left">
        <div className="text-sm font-medium">Labs</div>
        <div className="text-[11px] text-content-tertiary">Try experimental features</div>
      </div>
      {enabledCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold text-on-dark bg-accent rounded-full">
          {enabledCount > 9 ? '9+' : enabledCount}
        </span>
      )}
    </button>
  );
}
