/**
 * Nine-point anchor picker.
 *
 * Drawn as the 3x3 grid it represents rather than two dropdowns, because the
 * thing being chosen is a position on a face and a grid is what that looks
 * like. The same control serves every text host, so the mental model is
 * identical whether the user is placing a caption on a wall, a lid or a tab.
 */

import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { cn } from '@/design-system/cn';
import { TEXT_ANCHORS } from '@/features/bin-designer/types';
import type { TextAnchor } from '@/features/bin-designer/types';

interface AnchorPickerProps {
  readonly value: TextAnchor;
  readonly onChange: (anchor: TextAnchor) => void;
  readonly disabled?: boolean;
  readonly label?: string;
}

export function AnchorPicker({ value, onChange, disabled = false, label }: AnchorPickerProps) {
  const t = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={label ?? t('binDesigner.type.anchor')}
      className="grid w-fit grid-cols-3 gap-0.5 rounded-md border border-stroke-subtle bg-surface-secondary p-1"
    >
      {TEXT_ANCHORS.map((anchor) => {
        const active = anchor === value;
        return (
          <Button
            key={anchor}
            type="button"
            variant="ghost"
            role="radio"
            aria-checked={active}
            aria-label={t(`binDesigner.type.anchor.${anchor}`)}
            title={t(`binDesigner.type.anchor.${anchor}`)}
            disabled={disabled}
            onClick={() => onChange(anchor)}
            className={cn(
              'flex h-6 w-6 min-w-0 items-center justify-center rounded-sm p-0 transition-colors',
              disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface-hover',
              active && 'bg-accent hover:bg-accent'
            )}
          >
            <span
              className={cn(
                'block h-1.5 w-1.5 rounded-full',
                active ? 'bg-on-accent' : 'bg-content-tertiary'
              )}
              aria-hidden="true"
            />
          </Button>
        );
      })}
    </div>
  );
}
