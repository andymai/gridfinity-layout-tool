import { useTranslation } from '@/i18n';
import { SliderInput } from '@/design-system';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { LabelInfo } from '@/shared/components/InfoDot';

interface CornerRadii {
  readonly tl: number;
  readonly tr: number;
  readonly bl: number;
  readonly br: number;
}

interface CornerRadiusControlProps {
  readonly cornerRadius: number | undefined;
  readonly cornerRadii: CornerRadii | undefined;
  readonly maxRadius: number;
  /** Called on every slider frame; `onChangeEnd` follows once the change is done. */
  readonly onUniformChange: (r: number) => void;
  readonly onPerCornerChange: (radii: CornerRadii) => void;
  readonly onChangeEnd: () => void;
}

/** Corner radius controls with optional per-corner mode. */
export function CornerRadiusControl({
  cornerRadius,
  cornerRadii,
  maxRadius,
  onUniformChange,
  onPerCornerChange,
  onChangeEnd,
}: CornerRadiusControlProps) {
  const t = useTranslation();
  const perCorner = cornerRadii !== undefined;
  const uniformR = cornerRadius ?? 2.5;

  return (
    <>
      <SliderInput
        label={t('baseplate.cornerRadius')}
        value={uniformR}
        onChange={onUniformChange}
        onCommit={onChangeEnd}
        min={0}
        max={maxRadius}
        step={0.5}
        unit="mm"
        labelAddon={
          <LabelInfo label={t('baseplate.cornerRadius')}>
            {t('baseplate.cornerRadiusDetail')}
          </LabelInfo>
        }
        disabled={perCorner}
      />
      <FeatureToggle
        label={t('baseplate.cornerRadiusUnlink')}
        checked={perCorner}
        onChange={() => {
          if (perCorner) {
            onUniformChange(cornerRadii.tl);
          } else {
            onPerCornerChange({ tl: uniformR, tr: uniformR, bl: uniformR, br: uniformR });
          }
          onChangeEnd();
        }}
      />
      {perCorner && (
        <>
          <SliderInput
            label={t('baseplate.cornerRadiusTL')}
            value={cornerRadii.tl}
            onChange={(v) => onPerCornerChange({ ...cornerRadii, tl: v })}
            onCommit={onChangeEnd}
            min={0}
            max={maxRadius}
            step={0.5}
            unit="mm"
          />
          <SliderInput
            label={t('baseplate.cornerRadiusTR')}
            value={cornerRadii.tr}
            onChange={(v) => onPerCornerChange({ ...cornerRadii, tr: v })}
            onCommit={onChangeEnd}
            min={0}
            max={maxRadius}
            step={0.5}
            unit="mm"
          />
          <SliderInput
            label={t('baseplate.cornerRadiusBL')}
            value={cornerRadii.bl}
            onChange={(v) => onPerCornerChange({ ...cornerRadii, bl: v })}
            onCommit={onChangeEnd}
            min={0}
            max={maxRadius}
            step={0.5}
            unit="mm"
          />
          <SliderInput
            label={t('baseplate.cornerRadiusBR')}
            value={cornerRadii.br}
            onChange={(v) => onPerCornerChange({ ...cornerRadii, br: v })}
            onCommit={onChangeEnd}
            min={0}
            max={maxRadius}
            step={0.5}
            unit="mm"
          />
        </>
      )}
    </>
  );
}
