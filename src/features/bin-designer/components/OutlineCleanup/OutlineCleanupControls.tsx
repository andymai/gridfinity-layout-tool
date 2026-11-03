import { Button, SegmentedControl, SliderInput } from '@/design-system';
import { useTranslation } from '@/i18n';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import {
  isNoCleanup,
  type CleanupSettings,
  type MirrorAxisKind,
  type MirrorKeep,
} from '@/shared/outlineCleanup';

interface OutlineCleanupControlsProps {
  readonly settings: CleanupSettings;
  /**
   * A change to show. `done` is false while a slider is still moving, so the
   * caller can hold one undo step over the whole drag.
   */
  readonly onChange: (next: CleanupSettings, done: boolean) => void;
  readonly onReset: () => void;
  /** Whether y runs down the screen, which turns a level mirror line's sides over. */
  readonly yDown: boolean;
  /** Whether the mirror line in use runs upright, so its sides read as left and right. */
  readonly upright: boolean;
  /** Offer mirroring; off where one setting would land on many different tools. */
  readonly canMirror?: boolean;
  /** What edges square to, for the hint. */
  readonly squareTo: 'bin' | 'photo';
  readonly disabled?: boolean;
}

const SIDE_KEYS = {
  left: 'binDesigner.cutouts.outline.keep.left',
  right: 'binDesigner.cutouts.outline.keep.right',
  top: 'binDesigner.cutouts.outline.keep.top',
  bottom: 'binDesigner.cutouts.outline.keep.bottom',
} as const;

const SIMPLIFY_MAX_MM = 2;
const ROUND_MAX_MM = 5;

export function OutlineCleanupControls({
  settings,
  onChange,
  onReset,
  yDown,
  upright,
  canMirror = true,
  squareTo,
  disabled = false,
}: OutlineCleanupControlsProps) {
  const t = useTranslation();
  const set = (patch: Partial<CleanupSettings>, done = true) =>
    onChange({ ...settings, ...patch }, done);
  const mirror = settings.mirror;
  const low = upright ? 'left' : yDown ? 'top' : 'bottom';
  const high = upright ? 'right' : yDown ? 'bottom' : 'top';

  return (
    <div className="space-y-3">
      <SliderInput
        label={t('binDesigner.cutouts.outline.simplify')}
        value={settings.simplify}
        min={0}
        max={SIMPLIFY_MAX_MM}
        step={0.05}
        unit="mm"
        disabled={disabled}
        onChange={(simplify) => set({ simplify }, false)}
        onCommit={(simplify) => set({ simplify })}
      />
      <FeatureToggle
        label={t('binDesigner.cutouts.outline.curves')}
        info={t('binDesigner.cutouts.outline.curvesDetail')}
        checked={settings.curves}
        disabled={disabled}
        onChange={() => set({ curves: !settings.curves })}
      />
      <FeatureToggle
        label={t('binDesigner.cutouts.outline.straighten')}
        info={t(
          squareTo === 'bin'
            ? 'binDesigner.cutouts.outline.straightenDetail'
            : 'binDesigner.cutouts.outline.straightenPhotoDetail'
        )}
        checked={settings.straighten}
        disabled={disabled}
        onChange={() => set({ straighten: !settings.straighten })}
      />
      {canMirror && (
        <FeatureToggle
          label={t('binDesigner.cutouts.outline.mirror')}
          info={t('binDesigner.cutouts.outline.mirrorDetail')}
          checked={mirror !== null}
          disabled={disabled}
          onChange={() => set({ mirror: mirror ? null : { axis: 'detected', keep: 'average' } })}
          primaryControls={
            mirror && (
              <div className="space-y-2">
                <SegmentedControl<MirrorAxisKind>
                  aria-label={t('binDesigner.cutouts.outline.axis')}
                  size="sm"
                  value={mirror.axis}
                  onChange={(axis) => set({ mirror: { ...mirror, axis } })}
                  options={[
                    { value: 'detected', label: t('binDesigner.cutouts.outline.axisDetected') },
                    { value: 'vertical', label: t('binDesigner.cutouts.outline.axisUpright') },
                    { value: 'horizontal', label: t('binDesigner.cutouts.outline.axisLevel') },
                  ]}
                />
                <SegmentedControl<MirrorKeep>
                  aria-label={t('binDesigner.cutouts.outline.keep')}
                  size="sm"
                  value={mirror.keep}
                  onChange={(keep) => set({ mirror: { ...mirror, keep } })}
                  options={[
                    { value: 'low', label: t(SIDE_KEYS[low]) },
                    { value: 'high', label: t(SIDE_KEYS[high]) },
                    { value: 'average', label: t('binDesigner.cutouts.outline.keep.average') },
                  ]}
                />
              </div>
            )
          }
        />
      )}
      <SliderInput
        label={t('binDesigner.cutouts.outline.roundInside')}
        value={settings.roundInside}
        min={0}
        max={ROUND_MAX_MM}
        step={0.5}
        unit="mm"
        disabled={disabled}
        onChange={(roundInside) => set({ roundInside }, false)}
        onCommit={(roundInside) => set({ roundInside })}
      />
      {!isNoCleanup(settings) && (
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
          {t('binDesigner.cutouts.outline.reset')}
        </Button>
      )}
    </div>
  );
}
