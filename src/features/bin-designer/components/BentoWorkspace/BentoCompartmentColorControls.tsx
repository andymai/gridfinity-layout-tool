/**
 * Shadow-box colour controls for the Bento compartment inspector: a toggle, the
 * shared colour picker, and a floor / floor+walls surface selector. Deliberately
 * the same three controls `CutoutColorControls` offers, because it is the same
 * idea applied to a compartment instead of a cutout.
 *
 * Cosmetic only — the colour is resolved per triangle at paint time, so nothing
 * here regenerates geometry.
 */

import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { Button, CheckboxRow } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import {
  DEFAULT_COMPARTMENT_COLOR_SCOPE,
  type CompartmentColorScope,
} from '@/features/bin-designer/types';
import { DEFAULT_CUTOUT_COLOR } from '@/features/bin-designer/constants/defaults';
import { ColorZoneRow } from '../panel/ColorsSection/ColorZoneRow';

const SCOPES: readonly CompartmentColorScope[] = ['floor', 'floorAndWalls'];

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
      <span className="block text-micro font-semibold uppercase tracking-wider text-content-tertiary">
        {t('common.color')}
      </span>
      <CheckboxRow
        label={t('binDesigner.bento.color.enable')}
        checked={isColored}
        onChange={(checked) =>
          setCompartmentColor(compartmentId, checked ? DEFAULT_CUTOUT_COLOR : null)
        }
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

          <div
            role="group"
            aria-label={t('binDesigner.bento.color.surface')}
            className={SEGMENT_GROUP_CLASS}
          >
            {SCOPES.map((s) => (
              <Button
                key={s}
                type="button"
                variant="ghost"
                onClick={() => setCompartmentColorScope(compartmentId, s)}
                aria-pressed={scope === s}
                className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(scope === s)}`}
              >
                {t(`binDesigner.cutouts.color.${s}`)}
              </Button>
            ))}
          </div>

          <p className="text-micro leading-relaxed text-content-tertiary">
            {t('binDesigner.bento.color.note')}
          </p>
        </>
      )}
    </div>
  );
}
