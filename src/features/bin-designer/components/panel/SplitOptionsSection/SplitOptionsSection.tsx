import type { SplitViewMode } from '@/features/bin-designer/types';
import { FeatureToggle } from '../FeatureToggle';
import { SliderInput } from '../../controls/SliderInput';
import { useTranslation } from '@/i18n';
import { useSplitOptionsSection } from './useSplitOptionsSection';

const TOGGLE_BASE = 'px-2 py-1 text-[10px] font-medium transition-colors';
const TOGGLE_ACTIVE = `${TOGGLE_BASE} bg-surface-active text-content-primary`;
const TOGGLE_INACTIVE = `${TOGGLE_BASE} bg-surface-secondary text-content-tertiary hover:text-content-secondary`;

function toggleClass(isActive: boolean): string {
  return isActive ? TOGGLE_ACTIVE : TOGGLE_INACTIVE;
}

export function SplitOptionsSection() {
  const t = useTranslation();
  const { needsSplit, pieceCount, config, splitViewMode, handlers } = useSplitOptionsSection();

  if (!needsSplit) return null;

  const viewModeButton = (mode: SplitViewMode, label: string) => (
    <button
      type="button"
      className={toggleClass(splitViewMode === mode)}
      onClick={() => handlers.setSplitViewMode(mode)}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-content-secondary">
        {t('binDesigner.splitInfo', { count: pieceCount })}
      </p>

      <div className="flex items-center gap-2">
        <span className="text-xs text-content-secondary">{t('binDesigner.splitPreviewMode')}</span>
        <div className="flex rounded-md border border-stroke-subtle overflow-hidden">
          {viewModeButton('assembled', t('binDesigner.splitAssembled'))}
          {viewModeButton('exploded', t('binDesigner.splitExploded'))}
        </div>
      </div>

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
