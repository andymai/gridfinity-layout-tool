/**
 * Shadow-board color controls for the cutout inspector: a toggle, the shared
 * color picker, and a floor / floor+walls surface selector. Writes through
 * `setCutoutColor`, which spreads across a boolean group, auto-enables
 * multi-color, and stays cosmetic (no geometry regen). Works for one or many
 * selected cutouts; `null` inputs mean the selection is mixed.
 */

import { useTranslation } from '@/i18n';
import { Button, CheckboxRow } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import type { CutoutColorScope } from '@/features/bin-designer/types';
import { DEFAULT_CUTOUT_COLOR } from '@/features/bin-designer/constants/defaults';
import { ColorZoneRow } from '../panel/ColorsSection/ColorZoneRow';

const SCOPES: readonly CutoutColorScope[] = ['floor', 'floorAndWalls'];

interface CutoutColorControlsProps {
  readonly ids: readonly string[];
  /** Shared color: hex when uniform, undefined when all uncolored, null when mixed. */
  readonly color: string | null | undefined;
  /** Shared scope: value when uniform, undefined/null when uncolored/mixed. */
  readonly colorScope: CutoutColorScope | null | undefined;
  readonly disabled: boolean;
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

  // undefined = every selected cutout is uncolored; hex or null(mixed) = colored.
  const isColored = color !== undefined;
  const swatchColor = typeof color === 'string' ? color : DEFAULT_CUTOUT_COLOR;
  const activeScope = typeof colorScope === 'string' ? colorScope : null;

  return (
    <div className="space-y-2">
      <CheckboxRow
        label={t('binDesigner.cutouts.color.enable')}
        checked={isColored}
        disabled={disabled}
        onChange={(checked) =>
          setCutoutColor(ids, checked ? { color: DEFAULT_CUTOUT_COLOR } : { color: null })
        }
      />

      {isColored && (
        <>
          {/* ColorZoneRow has no `disabled` prop; `inert` neutralizes pointer
              AND keyboard interaction (and drops it from the a11y tree) so a
              locked cutout can't be recolored, matching the toggle/scope. */}
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

          <div
            role="group"
            aria-label={t('binDesigner.cutouts.color.surface')}
            className={SEGMENT_GROUP_CLASS}
          >
            {SCOPES.map((scope) => (
              <Button
                key={scope}
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => setCutoutColor(ids, { colorScope: scope })}
                aria-pressed={activeScope === scope}
                className={`flex-1 py-0.5 text-[10px] leading-none ${getSegmentClass(
                  activeScope === scope
                )}`}
              >
                {t(`binDesigner.cutouts.color.${scope}`)}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
