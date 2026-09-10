import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';

interface PreviewColorPickerProps {
  colors: ReadonlyArray<{ readonly color: string; readonly nameKey: string }>;
  previewColor: string;
  onColorSelect: (color: string) => void;
}

/** Swatch grid for a 3D preview's colour popover; the caller supplies the palette. */
export function PreviewColorPicker({
  colors,
  previewColor,
  onColorSelect,
}: PreviewColorPickerProps) {
  const t = useTranslation();
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {colors.map(({ color, nameKey }) => (
        <Button
          key={color}
          type="button"
          variant="ghost"
          onClick={() => onColorSelect(color)}
          className={`h-auto w-auto rounded-md p-0.5 transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none ${
            previewColor === color ? 'ring-2 ring-accent bg-surface-hover' : ''
          }`}
          aria-label={t('colors.colorAriaLabel', { name: t(nameKey) })}
          aria-selected={previewColor === color}
          role="option"
        >
          <span
            className={`inline-block h-6 w-6 rounded border transition-transform hover:scale-105 ${
              previewColor === color ? 'border-accent' : 'border-stroke-subtle/50'
            }`}
            style={{ backgroundColor: color }}
          />
        </Button>
      ))}
    </div>
  );
}
