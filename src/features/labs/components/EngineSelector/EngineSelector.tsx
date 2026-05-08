import { useShallow } from 'zustand/react/shallow';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { useLabsStore, useToastStore } from '@/core/store';
import { getFeature, type FeatureFlag } from '@/core/labs';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { useTranslation } from '@/i18n';
import { FeatureStatusBadge } from '../FeatureStatusBadge';
import { InfoIcon } from '../icons';

type Engine = 'default' | 'occt-wasm' | 'brepkit';

const BREPKIT_ID = 'brepkit_kernel' as const;
const OCCT_WASM_ID = 'occt_wasm_kernel' as const;

const ENGINE_FLAGS: Record<Engine, { brepkit: boolean; occt: boolean }> = {
  default: { brepkit: false, occt: false },
  'occt-wasm': { brepkit: false, occt: true },
  brepkit: { brepkit: true, occt: false },
};

function deriveEngine(brepkit: boolean, occt: boolean): Engine {
  if (brepkit) return 'brepkit';
  if (occt) return 'occt-wasm';
  return 'default';
}

function selectedFeatureFor(engine: Engine): FeatureFlag | undefined {
  switch (engine) {
    case 'brepkit':
      return getFeature(BREPKIT_ID);
    case 'occt-wasm':
      return getFeature(OCCT_WASM_ID);
    case 'default':
      return undefined;
  }
}

export function EngineSelector() {
  const t = useTranslation();
  const { brepkitEnabled, occtWasmEnabled } = useLabsStore(
    useShallow((state) => ({
      brepkitEnabled: state.preferences.enabledFeatures[BREPKIT_ID] ?? false,
      occtWasmEnabled: state.preferences.enabledFeatures[OCCT_WASM_ID] ?? false,
    }))
  );

  const current = deriveEngine(brepkitEnabled, occtWasmEnabled);

  const handleChange = (next: Engine) => {
    const target = ENGINE_FLAGS[next];
    if (brepkitEnabled === target.brepkit && occtWasmEnabled === target.occt) return;

    const labs = useLabsStore.getState();
    if (target.brepkit) labs.enableFeature(BREPKIT_ID);
    else labs.disableFeature(BREPKIT_ID);
    if (target.occt) labs.enableFeature(OCCT_WASM_ID);
    else labs.disableFeature(OCCT_WASM_ID);

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
    { value: 'occt-wasm' as const, label: t('labs.engine.segmentOcctWasm') },
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
