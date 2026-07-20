import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import {
  tagAppearanceKey,
  tagTint,
  useTagAppearanceStore,
} from '@/features/bin-designer/store/tagAppearance';
import { TagGlyph } from '../../TagGlyph';

interface TagFilterBarProps {
  allTags: readonly string[];
  activeTags: readonly string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

/** Toggle-chip row for filtering the design list by tag. Hidden when no tags exist. */
export function TagFilterBar({ allTags, activeTags, onToggle, onClear }: TagFilterBarProps) {
  const t = useTranslation();
  const appearances = useTagAppearanceStore((s) => s.appearances);
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
        const appearance = appearances[tagAppearanceKey(tag)];
        return (
          <Button
            key={tag}
            type="button"
            variant="ghost"
            onClick={() => onToggle(tag)}
            aria-pressed={isActive}
            className={`inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'border-accent bg-accent text-on-accent hover:bg-accent'
                : 'border-stroke bg-surface text-content-secondary hover:bg-surface-hover'
            }`}
            // The colored tint only applies while inactive — the active state
            // keeps the accent background so filter state stays unmistakable.
            style={
              !isActive && appearance?.color !== undefined
                ? { backgroundColor: tagTint(appearance.color) }
                : undefined
            }
            title={tag}
          >
            <TagGlyph appearance={appearance} />
            <span className="truncate">{tag}</span>
          </Button>
        );
      })}
      {activeTags.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          onClick={onClear}
          className="rounded-full px-2 py-1 hover:bg-transparent text-xs font-medium text-content-tertiary hover:text-content"
        >
          {t('binDesigner.tags.clearFilter')}
        </Button>
      )}
    </div>
  );
}
