import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { FeatureToggle } from '../FeatureToggle';
import { FeatureTip } from '../../FeatureTip';
import { FieldLabel, Hint, ShapePicker, SideSelector, StepperField } from '../shared';
import {
  resolvePullTab,
  resolvePullTabWalls,
  pullTabWallAxis,
  pullTabWallFields,
  planPullTabs,
  pullTabUnavailableReason,
  PULL_TAB_LIMITS,
  PULL_TAB_WALLS,
  MIN_PULL_TAB_WIDTH,
  PULL_TAB_END_CLEARANCE_MM,
  availablePullTabWidth,
} from '@/shared/utils/pullTabPlan';
import type { PullTabPlan } from '@/shared/utils/pullTabPlan';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import type { PullTabConfig, PullTabWall } from '@/features/bin-designer/types';

const WALL_LABEL: Record<PullTabWall, string> = {
  front: 'binDesigner.pullTab.side.front',
  back: 'binDesigner.pullTab.side.back',
  left: 'binDesigner.pullTab.side.left',
  right: 'binDesigner.pullTab.side.right',
};

/** One value per axis, or a single value when both axes agree to the shown precision. */
function perAxis(plans: readonly PullTabPlan[], read: (plan: PullTabPlan) => number) {
  const along = (axis: 'width' | 'depth') =>
    plans.find((plan) => pullTabWallAxis(plan.side) === axis);
  const front = along('width');
  const side = along('depth');
  if (!front || !side || read(front).toFixed(1) === read(side).toFixed(1)) return null;
  return { front: read(front).toFixed(1), side: read(side).toFixed(1) };
}

const FIELD_INFO: Partial<Record<keyof typeof PULL_TAB_LIMITS, string>> = {
  topRadius: 'binDesigner.pullTab.outlineHint',
  recessBorder: 'binDesigner.pullTab.recessDescription',
  recessEdgeRadius: 'binDesigner.pullTab.filletDescription',
};

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
  const walls = resolvePullTabWalls(tab);
  const enabled = { ...params, pullTab: { ...tab, enabled: true } };
  const plans = planPullTabs(enabled, rim, params.wallThickness);
  // The steppers show the longest wall's tab: the one the settings reach
  // unclamped, so a switch between mm and % keeps that tab's width. A shorter
  // wall's tab is narrower, which the axis hints report.
  const effective = plans.reduce<PullTabPlan | null>(
    (longest, plan) =>
      longest &&
      availablePullTabWidth(params, longest.side) >= availablePullTabWidth(params, plan.side)
        ? longest
        : plan,
    null
  );
  const longestWall = Math.max(...walls.map((wall) => availablePullTabWidth(params, wall)));
  // Worked out as the plan does, but even when nothing builds, so a unit
  // switch made while fixing a blocked selection keeps the tab's size.
  const longestTabWidth = Math.min(
    longestWall,
    Math.max(
      MIN_PULL_TAB_WIDTH,
      tab.widthMode === 'percent' ? (longestWall * tab.widthPercent) / 100 : tab.width
    )
  );
  const tooShort = walls.some((wall) => availablePullTabWidth(params, wall) < MIN_PULL_TAB_WIDTH);
  const belowRim = Math.max(
    0,
    ...plans.map((plan) => rim - plan.recessTop + plan.recessHeight)
  ).toFixed(1);
  const tabWidths = perAxis(plans, (plan) => plan.width);
  const recessWidths = perAxis(plans, (plan) => plan.recessWidth);
  const convertedWidth = (widthMode: PullTabConfig['widthMode']): Partial<PullTabConfig> => {
    // No selected wall can carry a tab, so there is no width to convert from.
    if (longestWall < MIN_PULL_TAB_WIDTH) return {};
    return widthMode === 'percent'
      ? { widthPercent: Math.round((longestTabWidth / longestWall) * 1000) / 10 }
      : { width: longestTabWidth };
  };
  const toggleWall = (wall: PullTabWall) => {
    const on = new Set(walls);
    if (on.has(wall)) {
      // A tab that is on and builds nothing is what the toggle above says.
      if (on.size === 1) return;
      on.delete(wall);
    } else {
      on.add(wall);
    }
    const fields = pullTabWallFields([...on]);
    update({ wall: fields.wall, walls: fields.walls });
  };
  const field = (
    key: keyof typeof PULL_TAB_LIMITS,
    min = PULL_TAB_LIMITS[key][0] as number,
    max = PULL_TAB_LIMITS[key][1] as number,
    step = 0.2
  ) => {
    const value = Math.round((effective?.[key] ?? tab[key]) * 100) / 100;
    const label = t(`binDesigner.pullTab.${key === 'widthPercent' ? 'width' : key}`);
    const set = (v: number) => update({ [key]: Math.min(max, Math.max(min, v)) });
    const infoKey = FIELD_INFO[key];
    return (
      <StepperField
        label={label}
        info={infoKey === undefined ? undefined : t(infoKey)}
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
      // The section's own walls and thickness can clear a lack of room, and a
      // tab already on can always be changed back, so neither locks the switch.
      disabledReason={
        reason && !tab.enabled && reason !== 'binDesigner.pullTab.noRoom' ? t(reason) : undefined
      }
      badge={
        <FeatureTip
          tip="pullTab"
          feature={t('binDesigner.pullTab.title')}
          detail={t('binDesigner.pullTab.description')}
        />
      }
      primaryControls={
        <div className="space-y-3">
          {reason && <Hint>{t(reason)}</Hint>}
          <div>
            <FieldLabel>{t('binDesigner.pullTab.wall')}</FieldLabel>
            <SideSelector
              ariaLabel={t('binDesigner.pullTab.sideAria')}
              sides={PULL_TAB_WALLS.map((wall) => ({
                side: wall,
                label: t(WALL_LABEL[wall]),
                active: walls.includes(wall),
                title: t(WALL_LABEL[wall]),
              }))}
              onToggle={toggleWall}
            />
          </div>
          {tooShort && (
            <Hint>
              {t('binDesigner.pullTab.wallTooShort', {
                min: String(MIN_PULL_TAB_WIDTH + PULL_TAB_END_CLEARANCE_MM),
              })}
            </Hint>
          )}
          {field('thickness', params.wallThickness, 4)}
          <ShapePicker
            value={tab.widthMode}
            ariaLabel={t('binDesigner.pullTab.widthUnit')}
            options={[
              { value: 'mm', label: 'mm' },
              { value: 'percent', label: '%' },
            ]}
            onChange={(widthMode) => update({ widthMode, ...convertedWidth(widthMode) })}
          />
          <div className="flex gap-2">
            {tab.widthMode === 'percent'
              ? field('widthPercent', 1, 100, 1)
              : field('width', MIN_PULL_TAB_WIDTH, Math.min(500, longestWall), 1)}
            {field('height', 3, 40, 1)}
          </div>
          {tabWidths ? (
            <Hint
              info={
                tab.widthMode === 'percent' ? t('binDesigner.pullTab.percentHintDetail') : undefined
              }
            >
              {t('binDesigner.pullTab.widthPerAxis', {
                front: tabWidths.front,
                side: tabWidths.side,
              })}
            </Hint>
          ) : (
            tab.widthMode === 'percent' && (
              <Hint info={t('binDesigner.pullTab.percentHintDetail')}>
                {t('binDesigner.pullTab.percentHint', {
                  width: (effective?.width ?? tab.width).toFixed(1),
                })}
              </Hint>
            )
          )}
          <div className="flex gap-2">
            {field('topRadius')}
            {field('rootRadius')}
          </div>
          {field('recessBorder')}
          <FeatureToggle
            label={t('binDesigner.pullTab.backRecess')}
            checked={tab.backRecess}
            onChange={() => update({ backRecess: !tab.backRecess })}
            info={t('binDesigner.pullTab.backRecessHint')}
          />
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
          {effective && (
            <Hint info={t('binDesigner.pullTab.recessSizeDetail')}>
              {recessWidths
                ? t('binDesigner.pullTab.recessSizePerAxis', {
                    front: recessWidths.front,
                    side: recessWidths.side,
                    below: belowRim,
                  })
                : t('binDesigner.pullTab.recessSize', {
                    width: effective.recessWidth.toFixed(1),
                    below: belowRim,
                  })}
            </Hint>
          )}
        </div>
      }
    />
  );
}
