/**
 * Shadow-board color controls for the cutout inspector: the Off / Floor /
 * Floor + walls picker, then the shared color picker once a surface is chosen.
 * Writes through `setCutoutColor`, which spreads across a boolean group,
 * auto-enables multi-color, and stays cosmetic (no geometry regen). Works for
 * one or many selected cutouts; `null` inputs mean the selection is mixed.
 */

import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_CUTOUT_COLOR_SCOPE, type CutoutColorScope } from '@/features/bin-designer/types';
import { DEFAULT_CUTOUT_COLOR } from '@/features/bin-designer/constants/defaults';
import { ColorZoneRow } from '../panel/ColorsSection/ColorZoneRow';
import {
  ColorSurfacePicker,
  type ColorSurfaceChoice,
} from '../panel/ColorsSection/ColorSurfacePicker';

interface CutoutColorControlsProps {
  readonly ids: readonly string[];
  /** Shared color: hex when uniform, undefined when all uncolored, null when mixed. */
  readonly color: string | null | undefined;
  /** Shared scope: value when uniform, undefined when unset, null when mixed. */
  readonly colorScope: CutoutColorScope | null | undefined;
  readonly disabled: boolean;
}

function surfaceChoice(
  color: string | null | undefined,
  colorScope: CutoutColorScope | null | undefined
): ColorSurfaceChoice | null {
  if (color === undefined) return 'off';
  if (colorScope === null) return null;
  // A color saved without a scope paints with the default, so show that.
  return colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE;
}

export function CutoutColorControls({
  ids,
  color,
  colorScope,
  disabled,
}: CutoutColorControlsProps) {
  const t = useTranslation();
  const setCutoutColor = useDesignerStore((s) => s.setCutoutColor);
  const bodyColor = useDesignerStore((s) => s.params.featureColors.body);

  const isColored = color !== undefined;
  const swatchColor = typeof color === 'string' ? color : DEFAULT_CUTOUT_COLOR;

  return (
    <div className="space-y-2">
      <ColorSurfacePicker
        value={surfaceChoice(color, colorScope)}
        onChange={(choice) =>
          setCutoutColor(ids, choice === 'off' ? { color: null } : { colorScope: choice })
        }
        ariaLabel={t('binDesigner.cutouts.color.surface')}
        disabled={disabled}
      />

      {isColored && (
        // ColorZoneRow has no `disabled` prop; `inert` neutralizes pointer AND
        // keyboard interaction (and drops it from the a11y tree) so a locked
        // cutout can't be recolored, matching the surface picker.
        <div inert={disabled || undefined} className={disabled ? 'opacity-60' : undefined}>
          <ColorZoneRow
            zone="body"
            label={color === null ? t('binDesigner.cutouts.color.mixed') : swatchColor}
            color={swatchColor}
            defaultColor={DEFAULT_CUTOUT_COLOR}
            otherColors={[]}
            bodyColor={bodyColor}
            recentColors={[]}
            onChange={(hex) => setCutoutColor(ids, { color: hex })}
            onHover={() => undefined}
          />
        </div>
      )}
    </div>
  );
}
