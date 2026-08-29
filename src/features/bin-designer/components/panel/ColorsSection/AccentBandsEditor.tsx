/**
 * Accent-band editor — the Top and Bottom colour bands, side by side under one
 * header because they are one feature with one entry unit.
 *
 * A band is a plane cut, not a piece of geometry: it recolours the outermost
 * N mm of the bin body at one end and wins over every zone it covers, so it is
 * the only control here that carries a height as well as a colour. Heights are
 * always STORED in mm; the mm|layers toggle is an authoring preference (see
 * `accentBandUnits.ts`) and never reaches the design.
 */

import { Checkbox } from '@/design-system';
import { SliderInput } from '@/design-system';
import { SegmentedControl } from '@/design-system/SegmentedControl/SegmentedControl';
import { useTranslation } from '@/i18n';
import type { AccentBandUnit } from '@/core/store/settings.types';
import type {
  AccentBandConfig,
  ColorZone,
  HoverableZone,
} from '@/features/bin-designer/types/featureColors';
import { accentBandLayers, accentBandScale } from '@/features/bin-designer/utils/accentBandUnits';
import { zoneTranslationKey } from '@/features/bin-designer/utils/zoneLabels';
import { ColorZoneRow } from './ColorZoneRow';

export interface AccentBandsEditorProps {
  top: AccentBandConfig;
  /** Absent until the user first enables the bottom band. */
  bottom: AccentBandConfig | undefined;
  /** Seed applied when a band is enabled for the first time. */
  defaultBand: AccentBandConfig;
  /** Tallest band this bin can carry (nominal height plus any wall collar). */
  maxMm: number;
  unit: AccentBandUnit;
  layerHeightMm: number;
  recentColors: readonly string[];
  swapActive: boolean;
  otherColorsFor: (zone: ColorZone) => readonly string[];
  bodyColor: string;
  onUnitChange: (unit: AccentBandUnit) => void;
  onChangeTop: (patch: Partial<AccentBandConfig>) => void;
  onChangeBottom: (patch: Partial<AccentBandConfig>) => void;
  onHover: (zone: HoverableZone | null) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onSwap: (zone: ColorZone) => void;
  onRememberColor: (hex: string) => void;
}

const UNIT_OPTIONS: { value: AccentBandUnit; labelKey: string }[] = [
  { value: 'mm', labelKey: 'binDesigner.colors.accent.unit.mm' },
  { value: 'layers', labelKey: 'binDesigner.colors.accent.unit.layers' },
];

export function AccentBandsEditor({
  top,
  bottom,
  defaultBand,
  maxMm,
  unit,
  layerHeightMm,
  recentColors,
  swapActive,
  otherColorsFor,
  bodyColor,
  onUnitChange,
  onChangeTop,
  onChangeBottom,
  onHover,
  onGestureStart,
  onGestureEnd,
  onSwap,
  onRememberColor,
}: AccentBandsEditorProps) {
  const t = useTranslation();

  const renderBand = (
    zone: 'topAccent' | 'bottomAccent',
    band: AccentBandConfig | undefined,
    onChange: (patch: Partial<AccentBandConfig>) => void,
    divided: boolean
  ) => {
    // An absent bottom band reads as disabled; enabling it seeds a full config
    // through the store updater, so the panel never writes a partial.
    const enabled = band?.enabled ?? false;
    const heightMm = band?.heightMm ?? defaultBand.heightMm;
    const color = band?.color ?? defaultBand.color;
    const label = t(zoneTranslationKey(zone));
    const toggle = () => onChange({ enabled: !enabled });
    const scale = accentBandScale(heightMm, maxMm, unit, layerHeightMm);
    const layers = accentBandLayers(heightMm, layerHeightMm);
    // Always show the other unit: a user in mm still needs to see whether the
    // band lands on a layer boundary, which is the print problem behind it.
    //
    // The layers-mode readout is derived from the slider's own value, not from
    // the stored mm. A height authored in mm and then viewed in layers is not a
    // layer multiple (2.35mm rounds to 12 layers), so reading the stored value
    // here would print "12 layers" beside "2.35mm" — two numbers that disagree.
    const info =
      layers === null
        ? undefined
        : unit === 'layers'
          ? t('binDesigner.colors.accent.mmInfo', {
              mm: String(scale.toMm(scale.value)),
              layerHeight: String(layerHeightMm),
            })
          : t('binDesigner.colors.accent.layersInfo', {
              layers: String(layers),
              layerHeight: String(layerHeightMm),
            });

    return (
      <div className={divided ? 'mt-1 border-t border-stroke-subtle/60 pt-1' : undefined}>
        <div
          className="group flex cursor-pointer items-center justify-between py-1"
          role="checkbox"
          aria-checked={enabled}
          aria-label={label}
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle();
            }
          }}
          onMouseEnter={enabled ? () => onHover(zone) : undefined}
          onMouseLeave={enabled ? () => onHover(null) : undefined}
        >
          <span className="text-label font-medium text-content-secondary">{label}</span>
          <Checkbox checked={enabled} />
        </div>
        {enabled && (
          <div className="space-y-2 pb-1">
            <SliderInput
              label={t('binDesigner.colors.accent.height')}
              value={scale.value}
              onChange={(v) => onChange({ heightMm: scale.toMm(v) })}
              min={scale.min}
              max={scale.max}
              step={scale.step}
              unit={unit === 'layers' ? t('binDesigner.colors.accent.unit.layers') : 'mm'}
              info={info}
            />
            <ColorZoneRow
              zone={zone}
              label={label}
              color={color}
              defaultColor={defaultBand.color}
              otherColors={otherColorsFor(zone)}
              bodyColor={bodyColor}
              recentColors={recentColors}
              onChange={(hex) => {
                onRememberColor(hex);
                onChange({ color: hex });
              }}
              onHover={onHover}
              onGestureStart={onGestureStart}
              onGestureEnd={onGestureEnd}
              onClickOverride={swapActive ? () => onSwap(zone) : undefined}
            />
          </div>
        )}
      </div>
    );
  };

  const anyEnabled = top.enabled || bottom?.enabled === true;

  return (
    <div className="border-t border-stroke-subtle pt-2">
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-label font-semibold uppercase tracking-wide text-content-secondary">
          {t('binDesigner.colors.accent.title')}
        </span>
        {anyEnabled && (
          <SegmentedControl
            size="sm"
            aria-label={t('binDesigner.colors.accent.unitLabel')}
            options={UNIT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            value={unit}
            onChange={onUnitChange}
          />
        )}
      </div>
      {anyEnabled ? null : (
        <p className="pb-1 text-label leading-snug text-content-tertiary">
          {t('binDesigner.colors.accent.hint')}
        </p>
      )}
      {renderBand('topAccent', top, onChangeTop, false)}
      {renderBand('bottomAccent', bottom, onChangeBottom, true)}
    </div>
  );
}
