/**
 * Off / Floor / Floor + walls for a cutout's or a Bento compartment's shadow
 * color. Choosing a surface is what turns the color on, so the surface choice
 * is always in view instead of appearing only after an enable toggle.
 */

import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import type { CutoutColorScope } from '@/features/bin-designer/types';

export type ColorSurfaceChoice = 'off' | CutoutColorScope;

const CHOICES: readonly ColorSurfaceChoice[] = ['off', 'floor', 'floorAndWalls'];

interface ColorSurfacePickerProps {
  /** Null when a multi-selection disagrees, which leaves every segment unpressed. */
  readonly value: ColorSurfaceChoice | null;
  readonly onChange: (choice: ColorSurfaceChoice) => void;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
}

export function ColorSurfacePicker({
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: ColorSurfacePickerProps) {
  const t = useTranslation();
  return (
    <div role="group" aria-label={ariaLabel} className={SEGMENT_GROUP_CLASS}>
      {CHOICES.map((choice) => (
        <Button
          key={choice}
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => onChange(choice)}
          aria-pressed={value === choice}
          // Sized to their labels: equal thirds wrap "Floor + walls" onto two lines.
          className={`flex-auto py-0.5 text-micro leading-none ${getSegmentClass(
            value === choice
          )}`}
        >
          {t(`binDesigner.cutouts.color.${choice}`)}
        </Button>
      ))}
    </div>
  );
}
