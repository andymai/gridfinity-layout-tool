import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { useLabsStore, useToastStore } from '@/core/store';
import { getFeature, type FeatureFlag } from '@/core/labs';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { useTranslation } from '@/i18n';
import { FeatureStatusBadge } from '../FeatureStatusBadge';
import { InfoIcon } from '../icons';
import { BREPKIT_ID } from './kernelIds';

type Engine = 'default' | 'brepkit';

function deriveEngine(brepkit: boolean): Engine {
  return brepkit ? 'brepkit' : 'default';
}

function selectedFeatureFor(engine: Engine): FeatureFlag | undefined {
  return engine === 'brepkit' ? getFeature(BREPKIT_ID) : undefined;
}

export function EngineSelector() {
  const t = useTranslation();
  const brepkitEnabled = useLabsStore(
    (state) => state.preferences.enabledFeatures[BREPKIT_ID] ?? false
  );

  const current = deriveEngine(brepkitEnabled);

  const handleChange = (next: Engine) => {
    const wantBrepkit = next === 'brepkit';
    if (brepkitEnabled === wantBrepkit) return;

    const labs = useLabsStore.getState();
    if (wantBrepkit) labs.enableFeature(BREPKIT_ID);
    else labs.disableFeature(BREPKIT_ID);

    trackEvent('labs_engine_changed', { from: current, to: next });

    const toastApi = useToastStore.getState();
    const reloadMessage = t('labs.engine.reloadToast');
    toastApi.toasts
      .filter((toast) => toast.message === reloadMessage)
      .forEach((toast) => toastApi.removeToast(toast.id));
    toastApi.addToast({
      message: reloadMessage,
      type: 'info',
      duration: 0,
      action: {
        label: t('labs.engine.reloadAction'),
        onClick: () => window.location.reload(),
      },
    });
  };

  const options = [
    { value: 'default' as const, label: t('labs.engine.segmentDefault') },
    { value: 'brepkit' as const, label: t('labs.engine.segmentBrepkit') },
  ];

  const selectedFeature = selectedFeatureFor(current);

  return (
    <article className="rounded-lg border border-stroke-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-[15px] font-semibold text-content leading-tight">
          {t('labs.engine.title')}
        </h3>
        {selectedFeature ? (
          <FeatureStatusBadge status={selectedFeature.status} />
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-success-muted text-success">
            {t('labs.engine.statusStable')}
          </span>
        )}
      </div>

      <SegmentedControl
        options={options}
        value={current}
        onChange={handleChange}
        ariaLabel={t('labs.engine.ariaLabel')}
      />

      <p className="mt-3 text-[13px] text-content-secondary leading-relaxed">
        {selectedFeature ? selectedFeature.description : t('labs.engine.descriptionDefault')}
      </p>

      {selectedFeature?.warning &&
        (selectedFeature.risk === 'medium' || selectedFeature.risk === 'high') && (
          <div
            className={`mt-3 flex items-start gap-2 text-xs p-2.5 rounded ${
              selectedFeature.risk === 'high'
                ? 'bg-warning-muted text-warning'
                : 'bg-info-muted text-info'
            }`}
          >
            <InfoIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{selectedFeature.warning}</span>
          </div>
        )}
    </article>
  );
}
