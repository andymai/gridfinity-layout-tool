import { useShallow } from 'zustand/react/shallow';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { useLabsStore, useToastStore } from '@/core/store';
import { getFeature, type FeatureFlag } from '@/core/labs';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { useTranslation } from '@/i18n';
import { FeatureStatusBadge } from '../FeatureStatusBadge';

type Engine = 'default' | 'occt-wasm' | 'brepkit';

const BREPKIT_ID = 'brepkit_kernel' as const;
const OCCT_WASM_ID = 'occt_wasm_kernel' as const;

function deriveEngine(brepkit: boolean, occt: boolean): Engine {
  if (brepkit) return 'brepkit';
  if (occt) return 'occt-wasm';
  return 'default';
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
    if (next === current) return;

    const labs = useLabsStore.getState();
    if (next === 'brepkit') {
      if (occtWasmEnabled) labs.disableFeature(OCCT_WASM_ID);
      labs.enableFeature(BREPKIT_ID);
    } else if (next === 'occt-wasm') {
      if (brepkitEnabled) labs.disableFeature(BREPKIT_ID);
      labs.enableFeature(OCCT_WASM_ID);
    } else {
      if (brepkitEnabled) labs.disableFeature(BREPKIT_ID);
      if (occtWasmEnabled) labs.disableFeature(OCCT_WASM_ID);
    }

    trackEvent('labs_engine_changed', { from: current, to: next });

    useToastStore.getState().addToast({
      message: t('labs.engine.reloadToast'),
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

  const occtFeature = getFeature(OCCT_WASM_ID);
  const brepkitFeature = getFeature(BREPKIT_ID);
  const selectedFeature: FeatureFlag | undefined =
    current === 'occt-wasm' ? occtFeature : current === 'brepkit' ? brepkitFeature : undefined;

  return (
    <article className="rounded-lg border border-stroke-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-[15px] font-semibold text-content leading-tight">
          {t('labs.engine.title')}
        </h3>
        {selectedFeature ? (
          <FeatureStatusBadge status={selectedFeature.status} />
        ) : (
          <span
            className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-success-muted text-success"
            aria-label={`Status: ${t('labs.engine.statusStable')}`}
          >
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

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
