import { useTranslation } from '@/i18n';

interface TagFilterBarProps {
  allTags: readonly string[];
  activeTags: readonly string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

/** Toggle-chip row for filtering the design list by tag. Hidden when no tags exist. */
export function TagFilterBar({ allTags, activeTags, onToggle, onClear }: TagFilterBarProps) {
  const t = useTranslation();
  if (allTags.length === 0) return null;

  const activeSet = new Set(activeTags.map((x) => x.toLowerCase()));

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label={t('binDesigner.tags.filterLabel')}
    >
      {allTags.map((tag) => {
        const isActive = activeSet.has(tag.toLowerCase());
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={isActive}
            className={`max-w-[10rem] truncate rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'border-accent bg-accent text-on-accent'
                : 'border-stroke bg-surface text-content-secondary hover:bg-surface-hover'
            }`}
            title={tag}
          >
            {tag}
          </button>
        );
      })}
      {activeTags.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-2 py-1 text-xs font-medium text-content-tertiary hover:text-content"
        >
          {t('binDesigner.tags.clearFilter')}
        </button>
      )}
    </div>
  );
}
