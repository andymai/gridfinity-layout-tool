import { useState, useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from '@/i18n';
import { Input, IconButton, XIcon, PlusIcon } from '@/design-system';
import { MAX_TAGS, normalizeTags } from '@/features/bin-designer/utils/tags';
import {
  tagAppearanceKey,
  tagTint,
  useTagAppearanceStore,
} from '@/features/bin-designer/store/tagAppearance';
import { TagGlyph } from '../../TagGlyph';

interface TagInputProps {
  value: readonly string[];
  onChange: (tags: string[]) => void;
  /** Tags already in use elsewhere, offered as one-click suggestions. */
  suggestions?: readonly string[];
}

/**
 * Controlled tag editor: current tags as removable chips plus an input that
 * commits on Enter or comma. Normalization (trim/dedupe/cap) is shared with the
 * storage layer via `normalizeTags`, so the editor can't produce a tag the
 * store would reject.
 */
export function TagInput({ value, onChange, suggestions }: TagInputProps) {
  const t = useTranslation();
  const [draft, setDraft] = useState('');
  const appearances = useTagAppearanceStore((s) => s.appearances);
  const atMax = value.length >= MAX_TAGS;

  const availableSuggestions = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const applied = new Set(value.map((tag) => tag.toLowerCase()));
    const query = draft.trim().toLowerCase();
    return suggestions.filter((tag) => {
      const key = tag.toLowerCase();
      return !applied.has(key) && (query === '' || key.includes(query));
    });
  }, [suggestions, value, draft]);

  const commit = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === '') return;
      const next = normalizeTags([...value, trimmed]);
      if (next.length !== value.length) onChange(next);
      setDraft('');
    },
    [value, onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => onChange(value.filter((x) => x !== tag));

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => {
            const appearance = appearances[tagAppearanceKey(tag)];
            return (
              <li key={tag}>
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-surface-elevated py-0.5 pl-2.5 pr-1 text-xs font-medium text-content"
                  style={
                    appearance?.color !== undefined
                      ? { backgroundColor: tagTint(appearance.color) }
                      : undefined
                  }
                >
                  <TagGlyph appearance={appearance} />
                  <span className="max-w-[10rem] truncate" title={tag}>
                    {tag}
                  </span>
                  <IconButton
                    type="button"
                    size="sm"
                    touchTarget={false}
                    onClick={() => removeTag(tag)}
                    className="h-auto w-auto rounded-full p-0.5 text-content-tertiary hover:bg-surface hover:text-content"
                    aria-label={t('binDesigner.tags.remove', { tag })}
                  >
                    <XIcon className="h-3 w-3" />
                  </IconButton>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        disabled={atMax}
        placeholder={
          atMax
            ? t('binDesigner.tags.max', { count: MAX_TAGS })
            : t('binDesigner.tags.addPlaceholder')
        }
        aria-label={t('binDesigner.tags.addPlaceholder')}
      />
      {!atMax && availableSuggestions.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-content-tertiary">
            {t('binDesigner.tags.suggestionsLabel')}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {availableSuggestions.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  // Keep focus in the input so its onBlur doesn't commit a
                  // half-typed draft before the suggestion click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(tag)}
                  className="inline-flex items-center gap-1 rounded-full border border-stroke bg-surface py-0.5 pl-1.5 pr-2.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
                  aria-label={t('binDesigner.tags.addExisting', { tag })}
                >
                  <PlusIcon className="h-3 w-3" aria-hidden="true" />
                  <TagGlyph appearance={appearances[tagAppearanceKey(tag)]} />
                  <span className="max-w-[10rem] truncate" title={tag}>
                    {tag}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
