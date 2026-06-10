import { FeatureToggle } from '../FeatureToggle';
import { useTranslation } from '@/i18n';
import { useSplitOptionsSection } from './useSplitOptionsSection';

const AXIS_KEYS = {
  width: 'binDesigner.splitAxisWidth',
  depth: 'binDesigner.splitAxisDepth',
  both: 'binDesigner.splitAxisBoth',
} as const;

export function SplitOptionsSection() {
  const t = useTranslation();
  const { needsSplit, pieceCount, splitAxis, config, handlers, nozzleSizeMm, showNozzleNotice } =
    useSplitOptionsSection();

  if (!needsSplit) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-content-secondary">
        {t('binDesigner.splitAxisInfo', {
          axis: t(AXIS_KEYS[splitAxis]),
          count: pieceCount,
        })}
      </p>

      <FeatureToggle
        label={t('binDesigner.splitConnectors')}
        checked={config.enabled}
        onChange={handlers.toggleEnabled}
      />

      <FeatureToggle
        label={t('binDesigner.splitWallConnectors')}
        checked={config.wallConnector === 'key'}
        onChange={handlers.toggleWallConnector}
      />

      {showNozzleNotice && (
        <p className="text-[11px] leading-relaxed text-content-tertiary">
          {t('binDesigner.splitConnectorNozzleNotice', { nozzle: nozzleSizeMm })}
        </p>
      )}
    </div>
  );
}
