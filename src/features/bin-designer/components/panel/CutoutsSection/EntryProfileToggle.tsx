import type { CutoutEntryProfile } from '@/features/bin-designer/types';
import { CUTOUT_ENTRY_PROFILES } from '@/features/bin-designer/types';
import { Button } from '@/design-system';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { useTranslation } from '@/i18n';

export interface EntryProfileToggleProps {
  /** Null when a selection mixes both shapes. */
  readonly value: CutoutEntryProfile | null;
  readonly onChange: (profile: CutoutEntryProfile) => void;
  readonly disabled?: boolean;
}

export function EntryProfileToggle({ value, onChange, disabled = false }: EntryProfileToggleProps) {
  const t = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('binDesigner.cutouts.entryProfile')}
      className={SEGMENT_GROUP_CLASS}
    >
      {CUTOUT_ENTRY_PROFILES.map((opt) => (
        <Button
          key={opt}
          type="button"
          variant="ghost"
          disabled={disabled}
          // Re-picking the active shape would still push an undo entry.
          onClick={() => {
            if (opt !== value) onChange(opt);
          }}
          aria-pressed={value === opt}
          className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(value === opt)}`}
        >
          {t(`binDesigner.cutouts.entryProfile.${opt}`)}
        </Button>
      ))}
    </div>
  );
}
