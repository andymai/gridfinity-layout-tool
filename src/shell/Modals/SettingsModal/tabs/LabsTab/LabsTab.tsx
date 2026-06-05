import { useShallow } from 'zustand/react/shallow';
import { useLabsStore } from '@/core/store';
import { getToggleableFeatures, getGraduatedFeatures } from '@/core/labs';
import type { FeatureId } from '@/core/labs';
import {
  EngineSelector,
  FeatureCard,
  GraduatedSection,
  KERNEL_FEATURE_IDS,
  SparklesIcon,
} from '@/features/labs/components';
import { useTranslation } from '@/i18n';

export function LabsTab() {
  const t = useTranslation();

  // Subscribe to `enabledFeatures` (a fresh object on every toggle) — not the
  // stable `isFeatureEnabled` reference — so the switches re-render when a flag
  // flips. The tab only renders toggleable (experimental/preview) features,
  // for which enabled state is exactly `enabledFeatures[id]`.
  const { toggleFeature, enabledFeatures } = useLabsStore(
    useShallow((state) => ({
      toggleFeature: state.toggleFeature,
      enabledFeatures: state.preferences.enabledFeatures,
    }))
  );

  const toggleableFeatures = getToggleableFeatures().filter(
    (f) => !KERNEL_FEATURE_IDS.some((id) => id === f.id)
  );
  const graduatedFeatures = getGraduatedFeatures();

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <SparklesIcon className="w-5 h-5 text-accent" />
          <h3 className="text-base font-semibold text-content">{t('settings.labs')}</h3>
        </div>
        <p className="text-sm text-content-tertiary mb-4">{t('settings.labsHint')}</p>

        <div className="mb-3">
          <EngineSelector />
        </div>

        {toggleableFeatures.length > 0 ? (
          <div className="space-y-3">
            {toggleableFeatures.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                isEnabled={enabledFeatures[feature.id as FeatureId] ?? false}
                onToggle={() => toggleFeature(feature.id as FeatureId)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-content-tertiary">
            <SparklesIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('settings.labsEmpty')}</p>
            <p className="text-xs mt-1">{t('settings.labsCheckBack')}</p>
          </div>
        )}

        <GraduatedSection features={graduatedFeatures} />
      </section>
    </div>
  );
}
