import { useState, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/design-system';
import { MAX_TAGS, normalizeTags } from '@/features/bin-designer/utils/tags';

interface TagInputProps {
  value: readonly string[];
  onChange: (tags: string[]) => void;
}

/**
 * Controlled tag editor: current tags as removable chips plus an input that
 * commits on Enter or comma. Normalization (trim/dedupe/cap) is shared with the
 * storage layer via `normalizeTags`, so the editor can't produce a tag the
 * store would reject.
 */
export function TagInput({ value, onChange }: TagInputProps) {
  const t = useTranslation();
  const [draft, setDraft] = useState('');
  const atMax = value.length >= MAX_TAGS;

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
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated py-0.5 pl-2.5 pr-1 text-xs font-medium text-content">
                <span className="max-w-[10rem] truncate" title={tag}>
                  {tag}
                </span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full p-0.5 text-content-tertiary hover:bg-surface hover:text-content"
                  aria-label={t('binDesigner.tags.remove', { tag })}
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            </li>
          ))}
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
    </div>
  );
}
