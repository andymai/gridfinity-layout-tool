import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { FeatureToggle } from '../FeatureToggle';
import { ShapePicker, StepperField } from '../shared';
import { CheckboxRow } from '@/design-system';
import {
  resolvePullTab,
  planPullTab,
  pullTabUnavailableReason,
  PULL_TAB_LIMITS,
  availablePullTabWidth,
} from '@/shared/utils/pullTabPlan';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import type { PullTabConfig } from '@/features/bin-designer/types';

export function PullTabSection() {
  const t = useTranslation();
  const { params, setParam } = useDesignerStore(
    useShallow((s) => ({ params: s.params, setParam: s.setParam }))
  );
  const tab = resolvePullTab(params.pullTab);
  const update = (patch: Partial<PullTabConfig>) =>
    setParam('pullTab', resolvePullTab({ ...tab, ...patch }));
  const reason = pullTabUnavailableReason(params);
  const { wallHeight } = binDimensions(params);
  const rim = wallHeight + (params.extraWallHeightMm ?? 0);
  const effective = planPullTab(
    { ...params, pullTab: { ...tab, enabled: true } },
    rim,
    params.wallThickness
  );
  const field = (
    key: keyof typeof PULL_TAB_LIMITS,
    min = PULL_TAB_LIMITS[key][0] as number,
    max = PULL_TAB_LIMITS[key][1] as number,
    step = 0.2
  ) => {
    const value = Math.round((effective?.[key] ?? tab[key]) * 100) / 100;
    const label = t(`binDesigner.pullTab.${key === 'widthPercent' ? 'width' : key}`);
    const set = (v: number) => update({ [key]: Math.min(max, Math.max(min, v)) });
    return (
      <StepperField
        label={label}
        unit={key === 'widthPercent' ? '%' : 'mm'}
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={set}
        onStep={(delta) => set(Math.round((value + delta * step) * 100) / 100)}
        size="md"
      />
    );
  };
  return (
    <FeatureToggle
      label={t('binDesigner.pullTab.title')}
      checked={tab.enabled}
      onChange={() => update({ enabled: !tab.enabled })}
      disabledReason={reason ? t(reason) : undefined}
      primaryControls={
        <div className="space-y-3">
          <p className="text-xs text-content-tertiary">{t('binDesigner.pullTab.description')}</p>
          <ShapePicker
            value={tab.wall}
            onChange={(wall) => update({ wall })}
            ariaLabel={t('binDesigner.pullTab.wall')}
            options={[
              { value: 'width', label: t('binDesigner.pullTab.widthWall') },
              { value: 'depth', label: t('binDesigner.pullTab.depthWall') },
            ]}
          />
          {field('thickness', params.wallThickness, 4)}
          <ShapePicker
            value={tab.widthMode}
            ariaLabel={t('binDesigner.pullTab.widthUnit')}
            options={[
              { value: 'mm', label: 'mm' },
              { value: 'percent', label: '%' },
            ]}
            onChange={(widthMode) =>
              update({
                widthMode,
                ...(widthMode === 'percent'
                  ? { widthPercent: Math.round((effective?.widthPercent ?? 75) * 10) / 10 }
                  : { width: effective?.width ?? tab.width }),
              })
            }
          />
          <div className="flex gap-2">
            {tab.widthMode === 'percent'
              ? field('widthPercent', 1, 100, 1)
              : field('width', 12, Math.min(500, availablePullTabWidth(params)), 1)}
            {field('height', 3, 40, 1)}
          </div>
          {tab.widthMode === 'percent' && (
            <p className="text-xs text-content-tertiary">
              {t('binDesigner.pullTab.percentHint', {
                width: (effective?.width ?? tab.width).toFixed(1),
              })}
            </p>
          )}
          <div className="flex gap-2">
            {field('topRadius')}
            {field('rootRadius')}
          </div>
          <p className="text-xs text-content-tertiary">{t('binDesigner.pullTab.outlineHint')}</p>
          <p className="text-xs text-content-tertiary">
            {t('binDesigner.pullTab.recessDescription')}
          </p>
          {field('recessBorder')}
          <CheckboxRow
            label={t('binDesigner.pullTab.backRecess')}
            checked={tab.backRecess}
            onChange={(backRecess) => update({ backRecess })}
          />
          {tab.backRecess && (
            <p className="text-xs text-content-tertiary">
              {t('binDesigner.pullTab.backRecessHint')}
            </p>
          )}
          <div className="flex gap-2">
            {field('recessHeight', 1, Math.min(80, rim + tab.height - params.wallThickness - 2), 1)}
            {field(
              'recessDepth',
              0,
              Math.max(
                0,
                ((effective?.thickness ?? tab.thickness) - 0.8) / (tab.backRecess ? 2 : 1)
              )
            )}
          </div>
          {field('recessRadius')}
          <div className="flex gap-2">
            {field('recessEdgeRadius')}
            {field('recessInsideRadius')}
          </div>
          <p className="text-xs text-content-tertiary">
            {t('binDesigner.pullTab.filletDescription')}
          </p>
          {effective && (
            <p className="text-xs text-content-tertiary">
              {t('binDesigner.pullTab.recessSize', {
                width: effective.recessWidth.toFixed(1),
                below: Math.max(0, rim - effective.recessTop + effective.recessHeight).toFixed(1),
              })}
            </p>
          )}
        </div>
      }
    />
  );
}
