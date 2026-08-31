import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Input, IconButton, SearchIcon, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useDesignerStore } from '@/features/bin-designer/store';
import { jumpToDesignerControl } from '@/features/bin-designer/settingsManifest';
import { binHasText } from '@/features/bin-designer/utils/binText';
import {
  useDesignerSettingsSearch,
  type DesignerSearchResult,
} from '@/features/bin-designer/search/useDesignerSettingsSearch';
import type { HighlightRange } from '@/features/bin-designer/search/matcher';

interface DesignerSearchBarProps {
  readonly viewMode: 'scroll' | 'rail';
  readonly needsSplit: boolean;
}

/** Renders `label` with the matched ranges emphasized. */
function highlighted(label: string, ranges: readonly HighlightRange[]): ReactNode {
  if (ranges.length === 0) return label;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(label.slice(cursor, start));
    parts.push(
      <span key={start} className="font-semibold text-content">
        {label.slice(start, end)}
      </span>
    );
    cursor = end;
  }
  if (cursor < label.length) parts.push(label.slice(cursor));
  return parts;
}

/**
 * A search field pinned at the top of the designer panel. Typing matches any
 * control or sub-option by name or synonym, ranked, with the match highlighted
 * and the owning section shown as a breadcrumb; an empty field lists the
 * sections by category to browse. Selecting a result jumps the panel to the
 * section that holds it (the same deep-link the Help modal uses).
 */
export function DesignerSearchBar({ viewMode, needsSplit }: DesignerSearchBarProps) {
  const t = useTranslation();
  const { style, hasText } = useDesignerStore(
    useShallow((s) => ({ style: s.params.style, hasText: binHasText(s.params) }))
  );
  const slideTrayEnabled = useFeatureFlag('sliding_tray');
  // Memoized so the search hook's `useMemo` isn't defeated by a fresh object
  // every render.
  const ctx = useMemo(
    () => ({ style, hasText, needsSplit, viewMode, slideTrayEnabled }),
    [style, hasText, needsSplit, viewMode, slideTrayEnabled]
  );

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const results = useDesignerSettingsSearch(query, ctx);
  const browsing = query.trim().length === 0;
  const open = focused;
  // Clamp: `results` can shrink (a param/view change) while the query is
  // unchanged, leaving `activeIndex` past the end.
  const activeOption = results.length > 0 ? Math.min(activeIndex, results.length - 1) : -1;

  const choose = (index: number) => {
    const result = results.at(index);
    if (!result) return;
    jumpToDesignerControl(result.controlId);
    setQuery('');
    setActiveIndex(0);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (query) {
        e.stopPropagation();
        e.preventDefault();
        setQuery('');
        setActiveIndex(0);
      } else {
        inputRef.current?.blur();
      }
      return;
    }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(activeOption);
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <div className="relative">
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          fullWidth
          size="sm"
          className="pl-2"
          leftIcon={<SearchIcon size="sm" />}
          rightIcon={
            query ? (
              <IconButton
                size="sm"
                variant="ghost"
                // Keep focus on the input so the dropdown stays open after clearing.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery('');
                  setActiveIndex(0);
                  inputRef.current?.focus();
                }}
                aria-label={t('common.clear')}
              >
                <XIcon size="sm" />
              </IconButton>
            ) : undefined
          }
          placeholder={t('settings.search.placeholder')}
          aria-label={t('settings.search.placeholder')}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && activeOption >= 0 ? `${listboxId}-opt-${activeOption}` : undefined
          }
          aria-autocomplete="list"
        />

        {open &&
          (results.length === 0 ? (
            <div
              role="status"
              className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-stroke bg-surface-secondary px-3 py-2 text-sm text-content-tertiary shadow-xl"
            >
              {t('settings.search.noResults', { query })}
            </div>
          ) : (
            <div
              id={listboxId}
              role="listbox"
              className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-stroke bg-surface-secondary py-1 shadow-xl scrollbar-thin"
            >
              {results.map((result, index) => (
                <ResultRow
                  key={result.id}
                  result={result}
                  index={index}
                  active={index === activeOption}
                  listboxId={listboxId}
                  showCategoryHeader={browsing && result.category !== results[index - 1]?.category}
                  searching={!browsing}
                  onChoose={() => choose(index)}
                  onHover={() => setActiveIndex(index)}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function ResultRow({
  result,
  index,
  active,
  listboxId,
  showCategoryHeader,
  searching,
  onChoose,
  onHover,
}: {
  readonly result: DesignerSearchResult;
  readonly index: number;
  readonly active: boolean;
  readonly listboxId: string;
  readonly showCategoryHeader: boolean;
  readonly searching: boolean;
  readonly onChoose: () => void;
  readonly onHover: () => void;
}) {
  // In search mode every row states where it lives: a sub-option shows its
  // parent section, a section shows its category.
  const location = result.breadcrumb ?? result.categoryLabel;
  return (
    <>
      {showCategoryHeader && (
        <div
          role="presentation"
          // Hold input focus so a click on the header doesn't blur-close the list.
          onMouseDown={(e) => e.preventDefault()}
          className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary"
        >
          {result.categoryLabel}
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- listbox option; keyboard is handled on the combobox input (Arrow/Enter), options aren't individually focusable */}
      <div
        id={`${listboxId}-opt-${index}`}
        role="option"
        aria-selected={active}
        tabIndex={-1}
        // Hold input focus so the click lands before blur would close the list.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onChoose}
        onMouseEnter={onHover}
        className={`flex w-full cursor-pointer flex-col px-3 py-1.5 text-left ${
          active ? 'bg-surface-hover' : ''
        }`}
      >
        <span className={`truncate text-sm ${active ? 'text-content' : 'text-content-secondary'}`}>
          {highlighted(result.label, result.highlight)}
        </span>
        {searching && <span className="truncate text-xs text-content-tertiary">{location}</span>}
      </div>
    </>
  );
}
