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
          // Re-picking the pressed surface would still write and push an undo entry.
          onClick={() => {
            if (choice !== value) onChange(choice);
          }}
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
