/**
 * Help modal — keyboard shortcuts catalog + tips reference.
 *
 * Splits across:
 *   - `helpModalStyles`         — shared style objects + shortcut types
 *   - `helpModalShortcutData`   — SHORTCUT_CATEGORIES catalog (data only)
 *   - `HelpModalSections`       — presentational sub-components
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useTranslation } from '@/i18n';
import { Button, Dialog, SearchInput, SegmentedControl } from '@/design-system';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { DocsLink } from '@/shared/components/DocsLink';
import { ShortcutBadge } from '@/shared/components/ShortcutBadge';
import { SHORTCUT_CATEGORIES } from './helpModalShortcutData';
import {
  ShortcutCategorySection,
  MouseInteractionsSection,
  TouchGesturesSection,
  TipsSection,
  BlockedZonesSection,
  BinClearanceSection,
} from './HelpModalSections';
import { getAllHelpEntries } from './helpEntryAggregator';
import { searchHelpEntries } from './helpSearch';
import { HelpSearchResultRow } from './HelpSearchResultRow';
import { useHelpRoute } from './useHelpRoute';
import {
  trackHelpSearchEmpty,
  trackHelpSearchJump,
  trackHelpCommandPaletteFallthrough,
} from '@/shared/analytics/posthog/events';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTablet?: boolean;
}

export function HelpModal({ isOpen, onClose, isTablet = false }: HelpModalProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog.Root open={isOpen} onClose={onClose} size="3xl" height="fixed" initialFocus={searchRef}>
      <HelpContent onClose={onClose} isTablet={isTablet} searchRef={searchRef} />
    </Dialog.Root>
  );
}

type HelpTab = 'shortcuts' | 'tips';

/** Dialog.Root mounts this once per opening, so each opening starts on a clear search. */
interface HelpContentProps {
  onClose: () => void;
  isTablet: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
}

function HelpContent({ onClose, isTablet, searchRef }: HelpContentProps) {
  const t = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<HelpTab>('shortcuts');

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const currentRoute = useHelpRoute();

  // Unified ranked search filtered to entries valid in the current mode.
  // A bin-designer user never sees layout-planner entries, etc — the
  // destination surfaces aren't mounted on the other route anyway.
  const allEntries = useMemo(() => getAllHelpEntries(currentRoute), [currentRoute]);
  const rankedResults = useMemo(() => {
    if (!isSearching) return [];
    return searchHelpEntries(allEntries, trimmedQuery, t);
  }, [allEntries, trimmedQuery, isSearching, t]);

  // Telemetry: fire on settled zero-result queries so we don't capture every
  // intermediate substring while the user is still typing (e.g. "x", "xy",
  // "xyz" → just "xyz"). 600ms after the last keystroke is enough to skip
  // mid-typing snapshots without feeling laggy.
  useEffect(() => {
    if (!isSearching || rankedResults.length > 0) return;
    const timer = window.setTimeout(() => {
      trackHelpSearchEmpty(trimmedQuery, currentRoute);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isSearching, rankedResults.length, trimmedQuery, currentRoute]);

  const tabOptions = useMemo(
    () => [
      { value: 'shortcuts' as const, label: t('help.shortcuts') },
      { value: 'tips' as const, label: t('help.tipsInfo') },
    ],
    [t]
  );

  return (
    <>
      <Dialog.Header title={t('help.title')} closeAriaLabel={t('common.close')} bordered />
      <Dialog.SubHeader className="flex items-center gap-4">
        {!isSearching && (
          <SegmentedControl
            options={tabOptions}
            value={activeTab}
            onChange={setActiveTab}
            aria-label={t('help.title')}
          />
        )}
        <SearchInput
          ref={searchRef}
          value={searchQuery}
          onValueChange={setSearchQuery}
          clearLabel={t('layouts.clearSearch')}
          placeholder={t('help.searchPlaceholder')}
          wrapperClassName="min-w-0 max-w-xs flex-1"
        />
        <DocsLink label={t('help.readDocs')} className="ml-auto shrink-0" />
      </Dialog.SubHeader>
      <Dialog.Body className="py-6 scrollbar-thin">
        {isSearching ? (
          <SearchResultsList
            results={rankedResults}
            query={trimmedQuery}
            currentRoute={currentRoute}
            onJump={onClose}
          />
        ) : activeTab === 'shortcuts' ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/10 border border-accent/20">
              <div className="shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {ICON_PATHS.bolt.map((d) => (
                    <path
                      key={d}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={d}
                    />
                  ))}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-content">{t('help.commandPaletteTip')}</p>
              </div>
              <ShortcutBadge keys="K" modifier className="shrink-0" />
            </div>

            {SHORTCUT_CATEGORIES.map((category) => (
              <ShortcutCategorySection key={category.id} category={category} />
            ))}

            <MouseInteractionsSection />
            {isTablet && <TouchGesturesSection />}
          </div>
        ) : (
          <div className="space-y-6">
            <TipsSection />
            <BlockedZonesSection />
            <BinClearanceSection />
          </div>
        )}
      </Dialog.Body>
    </>
  );
}

interface SearchResultsListProps {
  results: ReturnType<typeof searchHelpEntries>;
  query: string;
  currentRoute: string;
  onJump: () => void;
}

function SearchResultsList({ results, query, currentRoute, onJump }: SearchResultsListProps) {
  const t = useTranslation();
  const openCommandPalette = () => {
    trackHelpCommandPaletteFallthrough(query, currentRoute);
    window.dispatchEvent(new CustomEvent('open-command-palette', { detail: { query } }));
    onJump();
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-10 px-4 space-y-4">
        <p className="text-content-tertiary text-sm">{t('help.noResultsFor', { query })}</p>
        <Button type="button" variant="secondary" size="sm" onClick={openCommandPalette}>
          {t('help.openCommandPaletteWithQuery')}
        </Button>
      </div>
    );
  }
  return (
    <ul aria-label={t('help.searchResultsAriaLabel')} className="space-y-1">
      {results.map(({ entry }, index) => (
        <li key={entry.id}>
          <HelpSearchResultRow
            entry={entry}
            onJump={() => {
              trackHelpSearchJump(entry.id, query, index);
              onJump();
            }}
          />
        </li>
      ))}
    </ul>
  );
}
