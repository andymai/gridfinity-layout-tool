/**
 * Help modal — keyboard shortcuts catalog + tips reference.
 *
 * Splits across:
 *   - `helpModalStyles`         — shared style objects + key formatting helpers
 *   - `helpModalShortcutData`   — SHORTCUT_CATEGORIES catalog (data only)
 *   - `HelpModalSections`       — presentational sub-components
 */

import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { Button, IconButton, XIcon } from '@/design-system';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { STYLES, getModifierKey } from './helpModalStyles';
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
  const t = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'tips'>('shortcuts');

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

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
    if (!isOpen) return;
    if (!isSearching || rankedResults.length > 0) return;
    const timer = window.setTimeout(() => {
      trackHelpSearchEmpty(trimmedQuery, currentRoute);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isOpen, isSearching, rankedResults.length, trimmedQuery, currentRoute]);

  if (!isOpen) return null;

  const modifierKey = getModifierKey();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={STYLES.overlay}
      onClick={onClose}
      role="presentation"
    >
      <div role="presentation" onClick={(e) => e.stopPropagation()}>
        <div
          className="max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col animate-scale-in"
          style={STYLES.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 pb-4 border-b border-stroke-subtle">
            <h2 id="help-title" style={STYLES.title}>
              {t('help.title')}
            </h2>
            <IconButton onClick={onClose} touchTarget={false} aria-label={t('common.close')}>
              <XIcon size="md" />
            </IconButton>
          </div>

          {/* Tab bar and search */}
          <div className="px-6 py-3 border-b border-stroke-subtle flex items-center gap-4">
            {!isSearching && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('shortcuts')}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    activeTab === 'shortcuts'
                      ? 'bg-accent/20 text-accent hover:bg-accent/20 hover:text-accent'
                      : 'text-content-secondary hover:text-content hover:bg-surface-hover'
                  }`}
                >
                  {t('help.shortcuts')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('tips')}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    activeTab === 'tips'
                      ? 'bg-accent/20 text-accent hover:bg-accent/20 hover:text-accent'
                      : 'text-content-secondary hover:text-content hover:bg-surface-hover'
                  }`}
                >
                  {t('help.tipsInfo')}
                </Button>
              </div>
            )}

            <div className="flex-1 max-w-xs">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {ICON_PATHS.search.map((d) => (
                    <path
                      key={d}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={d}
                    />
                  ))}
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('help.searchPlaceholder')}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md bg-surface border border-stroke-subtle text-content placeholder:text-content-tertiary"
                />
                {searchQuery && (
                  <IconButton
                    onClick={() => setSearchQuery('')}
                    size="sm"
                    touchTarget={false}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content"
                    aria-label={t('layouts.clearSearch')}
                  >
                    <XIcon size="sm" />
                  </IconButton>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {isSearching ? (
              <SearchResultsList
                results={rankedResults}
                modifierKey={modifierKey}
                query={trimmedQuery}
                currentRoute={currentRoute}
                onJump={onClose}
              />
            ) : activeTab === 'shortcuts' ? (
              <div className="space-y-6">
                {/* Command palette tip */}
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
                  <div className="shrink-0 flex items-center gap-1">
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium rounded border border-stroke bg-gradient-to-b from-surface-elevated to-surface text-content shadow-[0_1px_0_1px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
                      {modifierKey}
                    </kbd>
                    <span className="text-content-tertiary text-xs">+</span>
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium rounded border border-stroke bg-gradient-to-b from-surface-elevated to-surface text-content shadow-[0_1px_0_1px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
                      K
                    </kbd>
                  </div>
                </div>

                {SHORTCUT_CATEGORIES.map((category) => (
                  <ShortcutCategorySection
                    key={category.id}
                    category={category}
                    modifierKey={modifierKey}
                  />
                ))}

                {/* Mouse/Touch section */}
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
          </div>
        </div>
      </div>
    </div>
  );
}

interface SearchResultsListProps {
  results: ReturnType<typeof searchHelpEntries>;
  modifierKey: string;
  query: string;
  currentRoute: string;
  onJump: () => void;
}

function SearchResultsList({
  results,
  modifierKey,
  query,
  currentRoute,
  onJump,
}: SearchResultsListProps) {
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
            modifierKey={modifierKey}
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
