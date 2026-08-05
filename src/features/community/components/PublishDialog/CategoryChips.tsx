/**
 * Eight categories is few enough to show at once. A dropdown hid every option
 * behind a click and gave no sense that the choice was small and required;
 * chips make the unanswered state visible and take one tap on the mobile
 * sheet.
 */

import { Button, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityCategory } from '@/shared/types/community';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';

export interface CategoryChipsProps {
  value: CommunityCategory | '';
  invalid: boolean;
  describedBy?: string;
  onChange: (category: CommunityCategory) => void;
}

const CATEGORIES = Object.keys(CATEGORY_LABEL_KEYS) as CommunityCategory[];

export function CategoryChips({ value, invalid, describedBy, onChange }: CategoryChipsProps) {
  const t = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t('community.publish.form.categoryLabel')}
      aria-required
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className={cn('flex flex-wrap gap-2', invalid && 'rounded-md p-1 ring-1 ring-error')}
    >
      {CATEGORIES.map((id) => {
        const selected = value === id;
        return (
          <Button
            key={id}
            role="radio"
            aria-checked={selected}
            variant={selected ? 'primary' : 'secondary'}
            className="min-h-11 rounded-full md:min-h-9"
            onClick={() => onChange(id)}
          >
            {t(CATEGORY_LABEL_KEYS[id])}
          </Button>
        );
      })}
    </div>
  );
}
