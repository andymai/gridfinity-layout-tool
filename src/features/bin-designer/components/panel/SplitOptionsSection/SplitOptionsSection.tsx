import { FeatureToggle } from '../FeatureToggle';
import { Hint } from '../shared';
import { useTranslation } from '@/i18n';
import { useSplitOptionsSection } from './useSplitOptionsSection';

const AXIS_KEYS = {
  width: 'binDesigner.splitAxisWidth',
  depth: 'binDesigner.splitAxisDepth',
  both: 'binDesigner.splitAxisBoth',
} as const;

export function SplitOptionsSection() {
  const t = useTranslation();
  const {
    needsSplit,
    keptWhole,
    splitToFitBed,
    printBedSize,
    pieceCount,
    splitAxis,
    config,
    handlers,
    nozzleSizeMm,
    showNozzleNotice,
    alignmentUnavailable,
  } = useSplitOptionsSection();

  return (
    <div className="space-y-3">
      {needsSplit && (
        <p className="text-xs text-content-secondary">
          {t('binDesigner.splitAxisInfo', {
            axis: t(AXIS_KEYS[splitAxis]),
            count: pieceCount,
          })}
        </p>
      )}

      {keptWhole && (
        <p className="text-label leading-relaxed text-warning">
          {t('binDesigner.printFit.keptWhole', {
            width: printBedSize.width,
            depth: printBedSize.depth,
          })}
        </p>
      )}

      <div className="space-y-1">
        <FeatureToggle
          label={t('binDesigner.splitToFitBed')}
          checked={splitToFitBed}
          onChange={handlers.toggleSplitToFitBed}
        />
        <Hint>{t('binDesigner.splitToFitBedHint')}</Hint>
      </div>

      {needsSplit && (
        <>
          <FeatureToggle
            label={t('binDesigner.splitConnectors')}
            checked={config.enabled && !alignmentUnavailable}
            onChange={handlers.toggleEnabled}
            disabledReason={
              alignmentUnavailable
                ? t('binDesigner.splitConnectorsUnavailableLightweight')
                : undefined
            }
          />

          <FeatureToggle
            label={t('binDesigner.splitWallConnectors')}
            checked={config.wallConnector === 'key'}
            onChange={handlers.toggleWallConnector}
          />

          {showNozzleNotice && (
            <Hint info={t('binDesigner.splitConnectorNozzleNotice', { nozzle: nozzleSizeMm })}>
              {t('binDesigner.splitConnectorNozzleNoticeShort', { nozzle: nozzleSizeMm })}
            </Hint>
          )}
        </>
      )}
    </div>
  );
}
