import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Input, IconButton, SearchIcon, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useSettingsSearch } from '../../hooks/useSettingsSearch';
import { useSettingsNav } from '../../SettingsModalContext';

interface SettingsSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
}

/**
 * Global settings search. Filters every registered section by label/keywords;
 * selecting a result switches to its tab and scrolls it into view. Lives in the
 * dialog sub-header.
 */
export function SettingsSearch({ query, onQueryChange }: SettingsSearchProps) {
  const t = useTranslation();
  const { navigateToSection } = useSettingsNav();
  const results = useSettingsSearch(query);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const open = query.trim().length > 0;

  const choose = (index: number) => {
    const result = results.at(index);
    if (!result) return;
    navigateToSection(result.tabId, result.id);
    onQueryChange('');
    setActiveIndex(0);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (query) {
        // Clear the query but keep the modal open.
        e.stopPropagation();
        e.preventDefault();
        onQueryChange('');
        setActiveIndex(0);
      }
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(activeIndex);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setActiveIndex(0);
        }}
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
              onClick={() => {
                onQueryChange('');
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
          open && results.length > 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
      />

      {open &&
        (results.length === 0 ? (
          // Kept out of the listbox: a listbox must only contain role="option".
          <div
            role="status"
            className="absolute inset-x-0 top-full z-10 mt-1 rounded-lg border border-stroke bg-surface-secondary px-3 py-2 text-sm text-content-tertiary shadow-xl"
          >
            {t('settings.search.noResults', { query })}
          </div>
        ) : (
          <div
            id={listboxId}
            role="listbox"
            className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-stroke bg-surface-secondary py-1 shadow-xl scrollbar-thin"
          >
            {results.map((result, index) => (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- listbox option; keyboard is handled on the combobox input (Arrow/Enter), options aren't individually focusable
              <div
                key={`${result.tabId}:${result.id}`}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                onClick={() => choose(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  index === activeIndex ? 'bg-surface-hover text-content' : 'text-content-secondary'
                }`}
              >
                <span className="truncate">{result.label}</span>
                <span className="flex-shrink-0 text-xs text-content-tertiary">
                  {t('settings.search.inTab', { tab: result.tabLabel })}
                </span>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
