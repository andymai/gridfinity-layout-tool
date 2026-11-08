/**
 * Shadow-board color controls for the cutout inspector. Writes through
 * `setCutoutColor`, which spreads across a boolean group, auto-enables
 * multi-color, and stays cosmetic (no geometry regen).
 */

import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_CUTOUT_COLOR_SCOPE, type Cutout } from '@/features/bin-designer/types';
import { DEFAULT_CUTOUT_COLOR } from '@/features/bin-designer/constants/defaults';
import { ColorZoneRow } from '../panel/ColorsSection/ColorZoneRow';
import {
  ColorSurfacePicker,
  type ColorSurfaceChoice,
} from '../panel/ColorsSection/ColorSurfacePicker';

type ColoredFields = Pick<Cutout, 'id' | 'color' | 'colorScope'>;

interface CutoutColorControlsProps {
  readonly cutouts: readonly ColoredFields[];
  readonly disabled: boolean;
}

// A color saved without a scope paints with the default, so it reads as that.
const surfaceOf = (c: ColoredFields): ColorSurfaceChoice =>
  c.color === undefined ? 'off' : (c.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE);

/** The one value every cutout shares, or null when they differ. */
function shared<T>(values: readonly T[]): T | null {
  return values.length > 0 && values.every((v) => v === values[0]) ? values[0] : null;
}

export function CutoutColorControls({ cutouts, disabled }: CutoutColorControlsProps) {
  const t = useTranslation();
  const setCutoutColor = useDesignerStore((s) => s.setCutoutColor);
  const bodyColor = useDesignerStore((s) => s.params.featureColors.body);

  const ids = cutouts.map((c) => c.id);
  const color = shared(cutouts.map((c) => c.color));
  const isColored = cutouts.some((c) => c.color !== undefined);
  const swatchColor = typeof color === 'string' ? color : DEFAULT_CUTOUT_COLOR;

  return (
    <div className="space-y-2">
      <ColorSurfacePicker
        value={shared(cutouts.map(surfaceOf))}
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
            label={typeof color === 'string' ? swatchColor : t('binDesigner.cutouts.color.mixed')}
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
