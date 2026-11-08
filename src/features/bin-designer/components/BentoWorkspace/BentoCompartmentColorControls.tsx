/**
 * Shadow-box colour controls for the Bento compartment inspector: the same
 * Off / Floor / Floor + walls picker and colour picker `CutoutColorControls`
 * offers, because it is the same idea applied to a compartment instead of a
 * cutout.
 *
 * Cosmetic only — the colour is resolved per triangle at paint time, so nothing
 * here regenerates geometry.
 */

import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { SubHeader } from '@/shared/components/PanelText';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_COMPARTMENT_COLOR_SCOPE } from '@/features/bin-designer/types';
import { DEFAULT_CUTOUT_COLOR } from '@/features/bin-designer/constants/defaults';
import { ColorZoneRow } from '../panel/ColorsSection/ColorZoneRow';
import { ColorSurfacePicker } from '../panel/ColorsSection/ColorSurfacePicker';

export interface BentoCompartmentColorControlsProps {
  readonly compartmentId: number;
}

export function BentoCompartmentColorControls({
  compartmentId,
}: BentoCompartmentColorControlsProps) {
  const t = useTranslation();
  const { color, scope, bodyColor, setCompartmentColor, setCompartmentColorScope } =
    useDesignerStore(
      useShallow((s) => ({
        color: s.params.compartments.compartmentColors?.[compartmentId] ?? null,
        scope:
          s.params.compartments.compartmentColorScopes?.[compartmentId] ??
          DEFAULT_COMPARTMENT_COLOR_SCOPE,
        bodyColor: s.params.featureColors.body,
        setCompartmentColor: s.setCompartmentColor,
        setCompartmentColorScope: s.setCompartmentColorScope,
      }))
    );

  const isColored = color !== null;
  const swatchColor = color ?? DEFAULT_CUTOUT_COLOR;

  return (
    <div className="space-y-2">
      <SubHeader>{t('common.color')}</SubHeader>
      <ColorSurfacePicker
        value={isColored ? scope : 'off'}
        onChange={(choice) =>
          choice === 'off'
            ? setCompartmentColor(compartmentId, null)
            : setCompartmentColorScope(compartmentId, choice)
        }
        ariaLabel={t('binDesigner.bento.color.surface')}
      />

      {isColored && (
        <>
          <ColorZoneRow
            zone="body"
            label={swatchColor}
            color={swatchColor}
            defaultColor={DEFAULT_CUTOUT_COLOR}
            otherColors={[]}
            bodyColor={bodyColor}
            recentColors={[]}
            onChange={(hex) => setCompartmentColor(compartmentId, hex)}
            onHover={() => undefined}
          />

          <p className="text-micro leading-relaxed text-content-tertiary">
            {t('binDesigner.bento.color.note')}
          </p>
        </>
      )}
    </div>
  );
}
