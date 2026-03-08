import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { SHORTCUTS } from '@/core/constants';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { CHANGELOG_ENTRIES, hasUnseenChangelog, markChangelogSeen } from '@/features/engagement';
import { trackEvent } from '@/shared/analytics/posthog';

// Style constants to avoid recreating objects on each render
const STYLES = {
  // Overlay and modal
  overlay: { backgroundColor: 'var(--overlay-dark)' } as CSSProperties,
  modal: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-xl)',
  } as CSSProperties,
  // Typography
  title: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 'var(--font-bold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
  sectionHeader: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as CSSProperties,
  textPrimary: { color: 'var(--text-primary)' } as CSSProperties,
  textSecondary: { color: 'var(--text-secondary)' } as CSSProperties,
  colorPrimary: { color: 'var(--color-primary)' } as CSSProperties,
  // Containers
  sectionContent: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
  } as CSSProperties,
  tipsList: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  } as CSSProperties,
  blockedZonesContent: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  } as CSSProperties,
  // Button
  buttonCompact: { minWidth: 'auto', minHeight: 'auto' } as CSSProperties,
  // Rows
  rowDescription: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' } as CSSProperties,
  rowAction: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' } as CSSProperties,
} as const;

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTablet?: boolean;
}

// Shortcut categories with their shortcuts
interface ShortcutItem {
  keys: string | readonly string[];
  descriptionKey: string; // Translation key
  modifier?: boolean; // Whether to show Ctrl/⌘ prefix
  shift?: boolean; // Whether to show Shift prefix
}

interface ShortcutCategory {
  id: string;
  nameKey: string; // Translation key
  icon: React.ReactNode;
  shortcuts: ShortcutItem[];
}

const KEY_SEPARATOR = '+';

const getModifierKey = () => {
  if (typeof navigator === 'undefined') return 'Ctrl';
  const isMac = /mac/i.test(navigator.userAgent);
  return isMac ? '⌘' : 'Ctrl';
};

const formatKey = (key: string | readonly string[]): string => {
  if (Array.isArray(key)) {
    return key.join(' / ');
  }
  return key as string;
};

// Define shortcut categories using translation keys
const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    id: 'general',
    nameKey: 'help.category.general',
    icon: <HelpCategoryIcon paths={ICON_PATHS.menu} />,
    shortcuts: [
      { keys: 'K', descriptionKey: 'help.shortcut.commandPalette', modifier: true },
      { keys: formatKey(SHORTCUTS.UNDO), descriptionKey: 'common.undo', modifier: true },
      { keys: formatKey(SHORTCUTS.REDO), descriptionKey: 'common.redo', modifier: true },
      { keys: formatKey(SHORTCUTS.HELP), descriptionKey: 'help.shortcut.showHelp' },
      { keys: formatKey(SHORTCUTS.ESCAPE), descriptionKey: 'help.shortcut.cancelDeselect' },
      { keys: SHORTCUTS.TOOL_SWITCH, descriptionKey: 'help.shortcut.toolSwitch', shift: true },
    ],
  },
  {
    id: 'editing',
    nameKey: 'help.category.editing',
    icon: <HelpCategoryIcon paths={ICON_PATHS.edit} />,
    shortcuts: [
      { keys: 'D', descriptionKey: 'help.shortcut.duplicate', modifier: true },
      { keys: formatKey(SHORTCUTS.DELETE), descriptionKey: 'help.shortcut.delete' },
      { keys: formatKey(SHORTCUTS.ROTATE).toUpperCase(), descriptionKey: 'help.shortcut.rotate' },
      {
        keys: formatKey(SHORTCUTS.QUICK_LABEL).toUpperCase(),
        descriptionKey: 'help.shortcut.quickLabel',
      },
      { keys: 'A', descriptionKey: 'help.shortcut.selectAll', modifier: true },
      { keys: 'Arrow keys', descriptionKey: 'help.shortcut.nudge' },
    ],
  },
  {
    id: 'navigation',
    nameKey: 'help.category.navigation',
    icon: <HelpCategoryIcon paths={ICON_PATHS.navigation} />,
    shortcuts: [
      {
        keys: formatKey(SHORTCUTS.LAYER_UP).toUpperCase(),
        descriptionKey: 'help.shortcut.layerUp',
      },
      {
        keys: formatKey(SHORTCUTS.LAYER_DOWN).toUpperCase(),
        descriptionKey: 'help.shortcut.layerDown',
      },
      {
        keys: formatKey(SHORTCUTS.SELECT_PREV_BIN).toUpperCase(),
        descriptionKey: 'help.shortcut.prevBin',
      },
      {
        keys: formatKey(SHORTCUTS.SELECT_NEXT_BIN).toUpperCase(),
        descriptionKey: 'help.shortcut.nextBin',
      },
      {
        keys: `${formatKey(SHORTCUTS.CATEGORY_PREV)} / ${formatKey(SHORTCUTS.CATEGORY_NEXT)}`,
        descriptionKey: 'help.shortcut.cycleCategory',
      },
    ],
  },
  {
    id: 'view',
    nameKey: 'help.category.view',
    icon: <HelpCategoryIcon paths={ICON_PATHS.eye} />,
    shortcuts: [
      { keys: formatKey(SHORTCUTS.ZOOM_IN), descriptionKey: 'help.shortcut.zoomIn' },
      { keys: formatKey(SHORTCUTS.ZOOM_OUT), descriptionKey: 'help.shortcut.zoomOut' },
      { keys: 'O', descriptionKey: 'help.shortcut.openLayoutManager', modifier: true },
    ],
  },
  {
    id: '3d-preview',
    nameKey: 'help.category.preview3d',
    icon: <HelpCategoryIcon paths={ICON_PATHS.cube} />,
    shortcuts: [
      {
        keys: formatKey(SHORTCUTS.PREVIEW_TOGGLE).toUpperCase(),
        descriptionKey: 'help.shortcut.togglePreview',
      },
      { keys: 'Space', descriptionKey: 'help.shortcut.expandPreview' },
    ],
  },
  {
    id: 'advanced',
    nameKey: 'help.category.advanced',
    icon: <HelpCategoryIcon paths={ICON_PATHS.settings} />,
    shortcuts: [
      {
        keys: formatKey(SHORTCUTS.HALF_BIN_TOGGLE).toUpperCase(),
        descriptionKey: 'help.shortcut.toggleHalfBin',
      },
      { keys: 'P', descriptionKey: 'help.shortcut.togglePaintMode' },
    ],
  },
];

export function HelpModal({ isOpen, onClose, isTablet = false }: HelpModalProps) {
  const t = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnseen] = useState(() => hasUnseenChangelog());
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'tips' | 'changelog'>(
    hasUnseen ? 'changelog' : 'shortcuts'
  );

  // Mark changelog as seen when the tab is active (covers both auto-open and click paths)
  useEffect(() => {
    if (isOpen && activeTab === 'changelog') {
      markChangelogSeen();
      trackEvent('changelog_viewed');
    }
  }, [isOpen, activeTab]);

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

  // Filter shortcuts based on search query (searches translated strings)
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return SHORTCUT_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return SHORTCUT_CATEGORIES.map((category) => ({
      ...category,
      shortcuts: category.shortcuts.filter(
        (shortcut) =>
          t(shortcut.descriptionKey).toLowerCase().includes(query) ||
          (typeof shortcut.keys === 'string' && shortcut.keys.toLowerCase().includes(query)) ||
          (Array.isArray(shortcut.keys) &&
            (shortcut.keys as readonly string[]).some((k) => k.toLowerCase().includes(query)))
      ),
    })).filter((category) => category.shortcuts.length > 0);
  }, [searchQuery, t]);

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
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={STYLES.buttonCompact}
              aria-label={t('common.close')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          </div>

          {/* Tab bar and search */}
          <div className="px-6 py-3 border-b border-stroke-subtle flex items-center gap-4">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  activeTab === 'shortcuts'
                    ? 'bg-accent/20 text-accent'
                    : 'text-content-secondary hover:text-content hover:bg-surface-hover'
                }`}
              >
                {t('help.shortcuts')}
              </button>
              <button
                onClick={() => setActiveTab('tips')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  activeTab === 'tips'
                    ? 'bg-accent/20 text-accent'
                    : 'text-content-secondary hover:text-content hover:bg-surface-hover'
                }`}
              >
                {t('help.tipsInfo')}
              </button>
              <button
                onClick={() => {
                  setActiveTab('changelog');
                }}
                className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  activeTab === 'changelog'
                    ? 'bg-accent/20 text-accent'
                    : 'text-content-secondary hover:text-content hover:bg-surface-hover'
                }`}
              >
                {t('changelog.whatsNew')}
                {hasUnseen && activeTab !== 'changelog' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent" />
                )}
              </button>
            </div>

            {activeTab === 'shortcuts' && (
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
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-content-tertiary hover:text-content focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={t('layouts.clearSearch')}
                    >
                      <svg
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
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {activeTab === 'shortcuts' ? (
              <div className="space-y-6">
                {/* Command palette tip */}
                {!searchQuery && (
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
                      {/* eslint-disable-next-line i18next/no-literal-string -- universal symbol */}
                      <span className="text-content-tertiary text-xs">+</span>
                      <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium rounded border border-stroke bg-gradient-to-b from-surface-elevated to-surface text-content shadow-[0_1px_0_1px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
                        K
                      </kbd>
                    </div>
                  </div>
                )}

                {filteredCategories.length === 0 ? (
                  <div className="text-center py-8 text-content-tertiary">
                    {t('help.noShortcutsFoundFor', { query: searchQuery })}
                  </div>
                ) : (
                  filteredCategories.map((category) => (
                    <ShortcutCategorySection
                      key={category.id}
                      category={category}
                      modifierKey={modifierKey}
                    />
                  ))
                )}

                {/* Mouse/Touch section */}
                {!searchQuery && (
                  <>
                    <MouseInteractionsSection />
                    {isTablet && <TouchGesturesSection />}
                  </>
                )}
              </div>
            ) : activeTab === 'tips' ? (
              <div className="space-y-6">
                <TipsSection />
                <BlockedZonesSection />
                <BinClearanceSection />
              </div>
            ) : (
              <div className="space-y-6">
                <ChangelogSection />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Shortcut category section component
function ShortcutCategorySection({
  category,
  modifierKey,
}: {
  category: ShortcutCategory;
  modifierKey: string;
}) {
  const t = useTranslation();
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent">{category.icon}</span>
        <h3 style={STYLES.sectionHeader}>{t(category.nameKey)}</h3>
      </div>
      <div className="grid gap-2">
        {category.shortcuts.map((shortcut, index) => (
          <ShortcutRow
            key={index}
            keys={shortcut.keys}
            description={t(shortcut.descriptionKey)}
            modifier={shortcut.modifier}
            shift={shortcut.shift}
            modifierKey={modifierKey}
          />
        ))}
      </div>
    </section>
  );
}

// Enhanced keyboard key component
function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium rounded border border-stroke bg-gradient-to-b from-surface-elevated to-surface text-content shadow-[0_1px_0_1px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  description,
  modifier,
  shift,
  modifierKey,
}: {
  keys: string | readonly string[];
  description: string;
  modifier?: boolean;
  shift?: boolean;
  modifierKey: string;
}) {
  const keyArray = typeof keys === 'string' ? keys.split(' / ') : [...keys];

  return (
    <div className="flex justify-between items-center py-1.5 px-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
      <span className="text-sm text-content-secondary">{description}</span>
      <div className="flex items-center gap-1">
        {modifier && (
          <>
            <KeyboardKey>{modifierKey}</KeyboardKey>
            <span className="text-content-tertiary text-xs">{KEY_SEPARATOR}</span>
          </>
        )}
        {shift && (
          <>
            <KeyboardKey>Shift</KeyboardKey>
            <span className="text-content-tertiary text-xs">{KEY_SEPARATOR}</span>
          </>
        )}
        {keyArray.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-content-tertiary text-xs mx-0.5">/</span>}
            <KeyboardKey>{key}</KeyboardKey>
          </span>
        ))}
      </div>
    </div>
  );
}

// Mouse interactions section
function MouseInteractionsSection() {
  const t = useTranslation();
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent">
          <HelpCategoryIcon paths={ICON_PATHS.mouse} />
        </span>
        <h3 style={STYLES.sectionHeader}>{t('help.mouse')}</h3>
      </div>
      <div className="grid gap-2">
        <InteractionRow
          action={t('help.mouse.clickDragEmpty')}
          description={t('help.mouse.drawNewBin')}
        />
        <InteractionRow action={t('help.mouse.clickBin')} description={t('help.mouse.selectBin')} />
        <InteractionRow
          action={t('help.mouse.shiftClick')}
          description={t('help.mouse.addToSelection')}
        />
        <InteractionRow
          action={t('help.mouse.dragSelected')}
          description={t('help.mouse.moveBins')}
        />
        <InteractionRow
          action={t('help.mouse.altDragSelected')}
          description={t('help.mouse.duplicateBins')}
        />
        <InteractionRow
          action={t('help.mouse.dragEdges')}
          description={t('help.mouse.resizeBin')}
        />
        <InteractionRow
          action={t('help.mouse.doubleClickBin')}
          description={t('help.mouse.quickLabelEdit')}
        />
        <InteractionRow
          action={t('help.mouse.rightClickBin')}
          description={t('help.mouse.contextMenu')}
        />
      </div>
    </section>
  );
}

// Touch gestures section
function TouchGesturesSection() {
  const t = useTranslation();
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent">
          <HelpCategoryIcon paths={ICON_PATHS.touch} />
        </span>
        <h3 style={STYLES.sectionHeader}>{t('help.touchGestures')}</h3>
      </div>
      <div className="grid gap-2">
        <InteractionRow
          action={t('help.gesture.tapBin')}
          description={t('help.gesture.selectBin')}
        />
        <InteractionRow
          action={t('help.gesture.dragEmpty')}
          description={t('help.gesture.drawNewBin')}
        />
        <InteractionRow
          action={t('help.gesture.dragSelected')}
          description={t('help.gesture.moveBin')}
        />
        <InteractionRow
          action={t('help.gesture.longPress')}
          description={t('help.gesture.openContextMenu')}
        />
        <InteractionRow
          action={t('help.gesture.dragEdge')}
          description={t('help.gesture.resizeBin')}
        />
      </div>
    </section>
  );
}

function InteractionRow({ action, description }: { action: string; description: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 px-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
      <span className="text-sm text-content-secondary">{description}</span>
      <span className="text-xs text-content-tertiary bg-surface-elevated px-2 py-1 rounded">
        {action}
      </span>
    </div>
  );
}

// Tips section
const TIP_KEYS = [
  'help.tip.binPalette',
  'help.tip.autoSplit',
  'help.tip.dragLayers',
  'help.tip.renameLayers',
  'help.tip.autoSave',
  'help.tip.quickOpen',
  'help.tip.halfBin',
] as const;

function TipsSection() {
  const t = useTranslation();

  return (
    <section>
      <h3 className="mb-4" style={{ ...STYLES.sectionHeader, fontSize: 'var(--text-lg)' }}>
        {t('help.tips')}
      </h3>
      <ul className="space-y-2 p-4 rounded-lg" style={STYLES.tipsList}>
        {TIP_KEYS.map((key) => (
          <li key={key} className="flex items-start gap-2">
            <span style={STYLES.colorPrimary}>•</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Blocked zones section
function BlockedZonesSection() {
  const t = useTranslation();
  return (
    <section>
      <h3 className="mb-4" style={{ ...STYLES.sectionHeader, fontSize: 'var(--text-lg)' }}>
        {t('help.blockedZones')}
      </h3>
      <div className="p-4 rounded-lg" style={STYLES.blockedZonesContent}>
        <p className="mb-3">
          <strong style={STYLES.textPrimary}>{t('help.whatAreBlockedZones')}</strong>
        </p>
        <p className="mb-3">{t('help.blockedZonesDescription')}</p>
        <p>
          <strong style={STYLES.textPrimary}>{t('help.example')}</strong>{' '}
          {t('help.blockedZonesExample')}
        </p>
      </div>
    </section>
  );
}

// Bin clearance section
function BinClearanceSection() {
  const t = useTranslation();
  return (
    <section>
      <h3 className="mb-4" style={{ ...STYLES.sectionHeader, fontSize: 'var(--text-lg)' }}>
        {t('help.binClearance')}
      </h3>
      <div className="p-4 rounded-lg" style={STYLES.blockedZonesContent}>
        <p className="mb-3">
          <strong style={STYLES.textPrimary}>{t('help.whatIsClearance')}</strong>
        </p>
        <p className="mb-3">{t('help.clearanceDescription')}</p>
        <p className="mb-3">
          <strong style={STYLES.textPrimary}>{t('help.example')}</strong>{' '}
          {t('help.clearanceExample')}
        </p>
        <p>{t('help.clearanceHowTo')}</p>
      </div>
    </section>
  );
}

// Changelog section
function ChangelogSection() {
  const t = useTranslation();

  if (CHANGELOG_ENTRIES.length === 0) {
    return <div className="text-center py-8 text-content-tertiary">{t('changelog.noEntries')}</div>;
  }

  return (
    <section>
      <h3 className="mb-4" style={{ ...STYLES.sectionHeader, fontSize: 'var(--text-lg)' }}>
        {t('changelog.whatsNew')}
      </h3>
      <div className="space-y-4">
        {CHANGELOG_ENTRIES.map((entry) => (
          <div key={entry.version} className="p-4 rounded-lg" style={STYLES.tipsList}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold" style={STYLES.textPrimary}>
                {t(entry.titleKey)}
              </h4>
              <span className="text-xs text-content-tertiary">{entry.version}</span>
            </div>
            <ul className="space-y-1.5">
              {entry.itemKeys.map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <span style={STYLES.colorPrimary}>•</span>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function HelpCategoryIcon({ paths }: { paths: readonly string[] }) {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}
