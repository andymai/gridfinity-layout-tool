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
import { SettingSection } from '../../components/SettingSection/SettingSection';

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
      <SettingSection
        id="labs"
        title={t('settings.labs')}
        hint={t('settings.labsHint')}
        icon={<SparklesIcon className="h-5 w-5 text-accent" />}
      >
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
          <div className="py-6 text-center text-content-tertiary">
            <SparklesIcon className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p className="text-sm">{t('settings.labsEmpty')}</p>
            <p className="mt-1 text-xs">{t('settings.labsCheckBack')}</p>
          </div>
        )}

        <GraduatedSection features={graduatedFeatures} />
      </SettingSection>
    </div>
  );
}
