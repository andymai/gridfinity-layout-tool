import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { getAllHelpEntries } from '@/shell/Modals/HelpModal/helpEntryAggregator';
import { searchHelpEntries } from '@/shell/Modals/HelpModal/helpSearch';
import { HelpSearchResultRow } from '@/shell/Modals/HelpModal/HelpSearchResultRow';
import { getModifierKey } from '@/shell/Modals/HelpModal/helpModalStyles';
import { useHelpRoute } from '@/shell/Modals/HelpModal/useHelpRoute';

// Style constants to avoid recreating objects on each render
const STYLES = {
  overlay: { backgroundColor: 'var(--overlay-dark)' } as CSSProperties,
  modal: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-xl)',
    boxShadow: 'var(--shadow-xl)',
  } as CSSProperties,
  title: {
    fontSize: 'var(--text-xl)',
    fontWeight: 'var(--font-bold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
  sectionHeader: {
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
  sectionContent: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
  } as CSSProperties,
  textSecondary: { color: 'var(--text-secondary)' } as CSSProperties,
  colorPrimary: { color: 'var(--color-primary)' } as CSSProperties,
  tipsList: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  } as CSSProperties,
  gestureIcon: {
    width: 32,
    height: 32,
    color: 'var(--color-accent)',
  } as CSSProperties,
  rowDescription: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' } as CSSProperties,
  rowAction: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' } as CSSProperties,
} as const;

interface MobileHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mobile-specific help modal showing touch gestures instead of keyboard shortcuts.
 */
export function MobileHelpModal({ isOpen, onClose }: MobileHelpModalProps) {
  const t = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  // Reset search on every close path so re-opening starts at the gesture
  // sections, not a stale filtered view.
  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const currentRoute = useHelpRoute();
  const allEntries = useMemo(() => getAllHelpEntries(currentRoute), [currentRoute]);
  const rankedResults = useMemo(
    () => (isSearching ? searchHelpEntries(allEntries, trimmedQuery, t) : []),
    [allEntries, trimmedQuery, isSearching, t]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const modifierKey = getModifierKey();

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center z-50 animate-fade-in"
      style={STYLES.overlay}
      onClick={handleClose}
      role="presentation"
    >
      <div role="presentation" onClick={(e) => e.stopPropagation()}>
        <div
          className="w-full sm:max-w-md mx-0 sm:mx-4 max-h-[85vh] overflow-y-auto scrollbar-thin animate-slide-up rounded-t-2xl sm:rounded-2xl"
          style={STYLES.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-help-title"
        >
          {/* Drag handle for bottom sheet feel */}
          <div className="flex justify-center mb-3 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-stroke" />
          </div>

          <div className="flex justify-between items-center mb-5">
            <h2 id="mobile-help-title" style={STYLES.title}>
              {t('mobile.help')}
            </h2>
            <button
              onClick={handleClose}
              className="btn btn-ghost w-10 h-10 p-0"
              aria-label={t('common.close')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <svg
              aria-hidden="true"
              focusable="false"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {ICON_PATHS.search.map((d) => (
                <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
              ))}
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('help.searchPlaceholder')}
              aria-label={t('help.searchPlaceholder')}
              className="w-full pl-9 pr-9 py-2 text-sm rounded-md bg-surface border border-stroke-subtle text-content placeholder:text-content-tertiary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-content-tertiary hover:text-content"
                aria-label={t('layouts.clearSearch')}
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {ICON_PATHS.close.map((d) => (
                    <path
                      key={d}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={d}
                    />
                  ))}
                </svg>
              </button>
            )}
          </div>

          {isSearching ? (
            <MobileSearchResultsList
              results={rankedResults}
              modifierKey={modifierKey}
              query={trimmedQuery}
              onJump={handleClose}
            />
          ) : (
            <div className="space-y-5">
              {/* Drawing & Selection */}
              <section>
                <h3 className="mb-3" style={STYLES.sectionHeader}>
                  {t('mobile.help.drawingSelection')}
                </h3>
                <div className="space-y-3 p-3 rounded-lg" style={STYLES.sectionContent}>
                  <GestureRow
                    icon={<TapIcon />}
                    gesture={t('help.gesture.tapBin')}
                    description={t('help.gesture.selectBin')}
                  />
                  <GestureRow
                    icon={<DragIcon />}
                    gesture={t('help.gesture.dragEmpty')}
                    description={t('help.gesture.drawNewBin')}
                  />
                  <GestureRow
                    icon={<DragIcon />}
                    gesture={t('help.gesture.dragSelected')}
                    description={t('help.gesture.moveBin')}
                  />
                  <GestureRow
                    icon={<LongPressIcon />}
                    gesture={t('help.gesture.longPress')}
                    description={t('help.gesture.openContextMenu')}
                  />
                </div>
              </section>

              {/* Editing */}
              <section>
                <h3 className="mb-3" style={STYLES.sectionHeader}>
                  {t('mobile.help.editing')}
                </h3>
                <div className="space-y-3 p-3 rounded-lg" style={STYLES.sectionContent}>
                  <GestureRow
                    icon={<DragEdgeIcon />}
                    gesture={t('help.gesture.dragEdge')}
                    description={t('help.gesture.resizeBin')}
                  />
                  <GestureRow
                    icon={<DragCornerIcon />}
                    gesture={t('help.gesture.dragCorner')}
                    description={t('help.gesture.resizeWidthDepth')}
                  />
                  <GestureRow
                    icon={<DragIcon />}
                    gesture={t('help.gesture.dragToStash')}
                    description={t('help.gesture.moveToStaging')}
                  />
                </div>
              </section>

              {/* Paint Mode */}
              <section>
                <h3 className="mb-3" style={STYLES.sectionHeader}>
                  {t('mobile.help.paintMode')}
                </h3>
                <div className="space-y-3 p-3 rounded-lg" style={STYLES.sectionContent}>
                  <GestureRow
                    icon={<TapIcon />}
                    gesture={t('help.gesture.tapPalette')}
                    description={t('help.gesture.enterPaintMode')}
                  />
                  <GestureRow
                    icon={<DragIcon />}
                    gesture={t('help.gesture.dragGrid')}
                    description={t('help.gesture.fillArea')}
                  />
                  <GestureRow
                    icon={<TapIcon />}
                    gesture={t('help.gesture.tapClose', { button: t('common.close') })}
                    description={t('help.gesture.exitPaintMode')}
                  />
                </div>
              </section>

              {/* Navigation */}
              <section>
                <h3 className="mb-3" style={STYLES.sectionHeader}>
                  {t('mobile.help.navigation')}
                </h3>
                <div className="space-y-3 p-3 rounded-lg" style={STYLES.sectionContent}>
                  <GestureRow
                    icon={<SwipeDownIcon />}
                    gesture={t('help.gesture.swipeDown')}
                    description={t('help.gesture.closeBottomSheet')}
                  />
                  <GestureRow
                    icon={<TapIcon />}
                    gesture={t('help.gesture.tapLayer')}
                    description={t('help.gesture.switchLayers')}
                  />
                  <GestureRow
                    icon={<TapIcon />}
                    gesture={t('help.gesture.tapStriped')}
                    description={t('help.gesture.jumpToBlocking')}
                  />
                </div>
              </section>

              {/* Tips */}
              <section>
                <h3 className="mb-3" style={STYLES.sectionHeader}>
                  {t('mobile.help.tips')}
                </h3>
                <ul className="space-y-2 p-3 rounded-lg" style={STYLES.tipsList}>
                  <li className="flex items-start gap-2">
                    <span style={STYLES.colorPrimary}>•</span>
                    <span>{t('mobile.help.longPressABinToDuplicateDeleteOrMov')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={STYLES.colorPrimary}>•</span>
                    <span>{t('mobile.help.tapThe3dCubeIconToSeeYourLayoutInIs')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={STYLES.colorPrimary}>•</span>
                    <span>{t('mobile.help.withKeyboardMToMoveBinsRToResizeVFo')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={STYLES.colorPrimary}>•</span>
                    <span>{t('mobile.help.oversizedBinsAreAutomaticallySplitF')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={STYLES.colorPrimary}>•</span>
                    <span>{t('mobile.help.yourLayoutAutoSavesToYourBrowser')}</span>
                  </li>
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MobileSearchResultsListProps {
  results: ReturnType<typeof searchHelpEntries>;
  modifierKey: string;
  query: string;
  onJump: () => void;
}

function MobileSearchResultsList({
  results,
  modifierKey,
  query,
  onJump,
}: MobileSearchResultsListProps) {
  const t = useTranslation();
  if (results.length === 0) {
    return (
      <div className="text-center py-6 text-content-tertiary text-sm">
        {t('help.noResultsFor', { query })}
      </div>
    );
  }
  return (
    <ul aria-label={t('help.searchResultsAriaLabel')} className="space-y-1">
      {results.map(({ entry }) => (
        <li key={entry.id}>
          <HelpSearchResultRow
            entry={entry}
            modifierKey={modifierKey}
            onJump={onJump}
            showJumpButton={false}
          />
        </li>
      ))}
    </ul>
  );
}

function GestureRow({
  icon,
  gesture,
  description,
}: {
  icon: React.ReactNode;
  gesture: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-accent">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div style={STYLES.rowDescription}>{description}</div>
        <div style={STYLES.rowAction}>{gesture}</div>
      </div>
    </div>
  );
}

// Gesture icons
function TapIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 2v4m0 12v4m10-10h-4M6 12H2"
      />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 11l5-5m0 0l5 5m-5-5v12"
      />
    </svg>
  );
}

function LongPressIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth={2} strokeDasharray="4 2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function DragEdgeIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="6" width="12" height="12" rx="1" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 12h4m0 0l-2-2m2 2l-2 2"
      />
    </svg>
  );
}

function DragCornerIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="4" width="10" height="10" rx="1" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 14l6 6m0 0h-4m4 0v-4"
      />
    </svg>
  );
}

function SwipeDownIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 14l-7 7m0 0l-7-7m7 7V3"
      />
    </svg>
  );
}
