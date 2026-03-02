import { FeatureToggle } from '../FeatureToggle';
import { SliderInput } from '../../controls/SliderInput';
import { useTranslation } from '@/i18n';
import { useSplitOptionsSection } from './useSplitOptionsSection';

export function SplitOptionsSection() {
  const t = useTranslation();
  const { needsSplit, pieceCount, config, handlers } = useSplitOptionsSection();

  if (!needsSplit) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-content-secondary">
        {t('binDesigner.splitInfo', { count: pieceCount })}
      </p>

      <FeatureToggle
        label={t('binDesigner.splitConnectors')}
        checked={config.enabled}
        onChange={handlers.toggleEnabled}
        valueSummary={config.enabled ? `${config.clearance}mm` : undefined}
      >
        <SliderInput
          label={t('binDesigner.splitClearance')}
          value={config.clearance}
          onChange={handlers.setClearance}
          min={0.05}
          max={0.3}
          step={0.05}
          unit="mm"
        />
      </FeatureToggle>
    </div>
  );
}
