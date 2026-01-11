import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { SHORTCUTS } from '../../constants';

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
  description: string;
  modifier?: boolean; // Whether to show Ctrl/⌘ prefix
}

interface ShortcutCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  shortcuts: ShortcutItem[];
}

const getModifierKey = () => {
  if (typeof navigator === 'undefined') return 'Ctrl';
  const isMac = navigator.platform.toLowerCase().includes('mac');
  return isMac ? '⌘' : 'Ctrl';
};

const formatKey = (key: string | readonly string[]): string => {
  if (Array.isArray(key)) {
    return key.join(' / ');
  }
  return key as string;
};

// Define shortcut categories with translation keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getShortcutCategories = (t: (key: string) => any): ShortcutCategory[] => [
  {
    id: 'general',
    name: t('help:categories.general'),
    icon: <CommandIcon />,
    shortcuts: [
      { keys: formatKey(SHORTCUTS.UNDO), description: t('help:shortcuts.undo'), modifier: true },
      { keys: formatKey(SHORTCUTS.REDO), description: t('help:shortcuts.redo'), modifier: true },
      { keys: formatKey(SHORTCUTS.HELP), description: t('help:shortcuts.showHelp') },
      { keys: formatKey(SHORTCUTS.ESCAPE), description: t('help:shortcuts.escape') },
    ],
  },
  {
    id: 'editing',
    name: t('help:categories.editing'),
    icon: <EditIcon />,
    shortcuts: [
      { keys: 'D', description: t('help:shortcuts.duplicate'), modifier: true },
      { keys: formatKey(SHORTCUTS.DELETE), description: t('help:shortcuts.delete') },
      { keys: formatKey(SHORTCUTS.QUICK_LABEL).toUpperCase(), description: t('help:shortcuts.quickLabel') },
      { keys: t('help:keys.arrowKeys'), description: t('help:shortcuts.nudge') },
    ],
  },
  {
    id: 'navigation',
    name: t('help:categories.navigation'),
    icon: <NavigationIcon />,
    shortcuts: [
      { keys: formatKey(SHORTCUTS.LAYER_UP).toUpperCase(), description: t('help:shortcuts.layerUp') },
      { keys: formatKey(SHORTCUTS.LAYER_DOWN).toUpperCase(), description: t('help:shortcuts.layerDown') },
      { keys: formatKey(SHORTCUTS.SELECT_PREV_BIN).toUpperCase(), description: t('help:shortcuts.prevBin') },
      { keys: formatKey(SHORTCUTS.SELECT_NEXT_BIN).toUpperCase(), description: t('help:shortcuts.nextBin') },
      { keys: `${formatKey(SHORTCUTS.CATEGORY_PREV)} / ${formatKey(SHORTCUTS.CATEGORY_NEXT)}`, description: t('help:shortcuts.cycleCategory') },
    ],
  },
  {
    id: 'view',
    name: t('help:categories.view'),
    icon: <ViewIcon />,
    shortcuts: [
      { keys: formatKey(SHORTCUTS.ZOOM_IN), description: t('help:shortcuts.zoomIn') },
      { keys: formatKey(SHORTCUTS.ZOOM_OUT), description: t('help:shortcuts.zoomOut') },
      { keys: 'O', description: t('help:shortcuts.openLayoutManager'), modifier: true },
    ],
  },
  {
    id: '3d-preview',
    name: t('help:categories.preview'),
    icon: <CubeIcon />,
    shortcuts: [
      { keys: formatKey(SHORTCUTS.PREVIEW_TOGGLE).toUpperCase(), description: t('help:shortcuts.togglePreview') },
      { keys: t('help:keys.space'), description: t('help:shortcuts.expandPreview') },
      { keys: '1', description: t('help:shortcuts.cameraIsometric') },
      { keys: '2', description: t('help:shortcuts.cameraFront') },
      { keys: '3', description: t('help:shortcuts.cameraSide') },
    ],
  },
  {
    id: 'advanced',
    name: t('help:categories.advanced'),
    icon: <SettingsIcon />,
    shortcuts: [
      { keys: formatKey(SHORTCUTS.HALF_BIN_TOGGLE).toUpperCase(), description: t('help:shortcuts.toggleHalfBinMode') },
    ],
  },
];

export function HelpModal({ isOpen, onClose, isTablet = false }: HelpModalProps) {
  const { t } = useTranslation(['help', 'common', 'aria']);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'tips'>('shortcuts');

  // Generate shortcut categories with translations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shortcutCategories = useMemo(() => getShortcutCategories(t as any), [t]);

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

  // Filter shortcuts based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return shortcutCategories;

    const query = searchQuery.toLowerCase();
    return shortcutCategories.map(category => ({
      ...category,
      shortcuts: category.shortcuts.filter(
        shortcut =>
          shortcut.description.toLowerCase().includes(query) ||
          (typeof shortcut.keys === 'string' && shortcut.keys.toLowerCase().includes(query)) ||
          (Array.isArray(shortcut.keys) && shortcut.keys.some(k => k.toLowerCase().includes(query)))
      ),
    })).filter(category => category.shortcuts.length > 0);
  }, [searchQuery, shortcutCategories]);

  if (!isOpen) return null;

  const modifierKey = getModifierKey();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={STYLES.overlay}
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col animate-scale-in"
        style={STYLES.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-4 border-b border-stroke-subtle">
          <h2 id="help-title" style={STYLES.title}>
            {t('help:title')}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={STYLES.buttonCompact}
            aria-label={t('aria:actions.closeModal')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab bar and search */}
        <div className="px-6 py-3 border-b border-stroke-subtle flex items-center gap-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'shortcuts'
                  ? 'bg-accent/20 text-accent'
                  : 'text-content-secondary hover:text-content hover:bg-surface-hover'
              }`}
            >
              {t('help:tabs.shortcuts')}
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'tips'
                  ? 'bg-accent/20 text-accent'
                  : 'text-content-secondary hover:text-content hover:bg-surface-hover'
              }`}
            >
              {t('help:tabs.tipsAndInfo')}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common:placeholders.searchShortcuts')}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md bg-surface border border-stroke-subtle focus:outline-none focus:ring-2 focus:ring-accent/50 text-content placeholder:text-content-tertiary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
              {filteredCategories.length === 0 ? (
                <div className="text-center py-8 text-content-tertiary">
                  {t('help:noResultsFor', { query: searchQuery })}
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
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent">{category.icon}</span>
        <h3 style={STYLES.sectionHeader}>{category.name}</h3>
      </div>
      <div className="grid gap-2">
        {category.shortcuts.map((shortcut, index) => (
          <ShortcutRow
            key={index}
            keys={shortcut.keys}
            description={shortcut.description}
            modifier={shortcut.modifier}
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
  modifierKey,
}: {
  keys: string | readonly string[];
  description: string;
  modifier?: boolean;
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
            <span className="text-content-tertiary text-xs">+</span>
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
  const { t } = useTranslation(['help']);
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent"><MouseIcon /></span>
        <h3 style={STYLES.sectionHeader}>{t('help:mouse.title')}</h3>
      </div>
      <div className="grid gap-2">
        <InteractionRow action={t('help:mouse.clickDragEmpty')} description={t('help:mouse.drawNewBin')} />
        <InteractionRow action={t('help:mouse.clickBin')} description={t('help:mouse.selectBin')} />
        <InteractionRow action={t('help:mouse.shiftClick')} description={t('help:mouse.addToSelection')} />
        <InteractionRow action={t('help:mouse.dragSelected')} description={t('help:mouse.moveBins')} />
        <InteractionRow action={t('help:mouse.dragEdges')} description={t('help:mouse.resizeBin')} />
        <InteractionRow action={t('help:mouse.doubleClick')} description={t('help:mouse.quickLabelEdit')} />
        <InteractionRow action={t('help:mouse.rightClick')} description={t('help:mouse.contextMenu')} />
      </div>
    </section>
  );
}

// Touch gestures section
function TouchGesturesSection() {
  const { t } = useTranslation(['help']);
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent"><TouchIcon /></span>
        <h3 style={STYLES.sectionHeader}>{t('help:touch.title')}</h3>
      </div>
      <div className="grid gap-2">
        <InteractionRow action={t('help:touch.tapBin')} description={t('help:touch.select')} />
        <InteractionRow action={t('help:touch.dragEmpty')} description={t('help:touch.drawNewBin')} />
        <InteractionRow action={t('help:touch.dragSelected')} description={t('help:touch.moveBin')} />
        <InteractionRow action={t('help:touch.longPress')} description={t('help:touch.contextMenu')} />
        <InteractionRow action={t('help:touch.dragEdge')} description={t('help:touch.resize')} />
      </div>
    </section>
  );
}

function InteractionRow({ action, description }: { action: string; description: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 px-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
      <span className="text-sm text-content-secondary">{description}</span>
      <span className="text-xs text-content-tertiary bg-surface-elevated px-2 py-1 rounded">{action}</span>
    </div>
  );
}

// Tips section
function TipsSection() {
  const { t } = useTranslation(['help']);

  return (
    <section>
      <h3 className="mb-4" style={{ ...STYLES.sectionHeader, fontSize: 'var(--text-lg)' }}>
        {t('help:tips.title')}
      </h3>
      <ul className="space-y-2 p-4 rounded-lg" style={STYLES.tipsList}>
        <li className="flex items-start gap-2">
          <span style={STYLES.colorPrimary}>•</span>
          <span>{t('help:tips.binPalette')}</span>
        </li>
        <li className="flex items-start gap-2">
          <span style={STYLES.colorPrimary}>•</span>
          <span>{t('help:tips.autoSplit')}</span>
        </li>
        <li className="flex items-start gap-2">
          <span style={STYLES.colorPrimary}>•</span>
          <span>{t('help:tips.dragLayers')}</span>
        </li>
        <li className="flex items-start gap-2">
          <span style={STYLES.colorPrimary}>•</span>
          <span>{t('help:tips.doubleClickRename')}</span>
        </li>
        <li className="flex items-start gap-2">
          <span style={STYLES.colorPrimary}>•</span>
          <span>{t('help:tips.autoSave')}</span>
        </li>
        <li className="flex items-start gap-2">
          <span style={STYLES.colorPrimary}>•</span>
          <span>{t('help:tips.layoutManagerShortcut')}</span>
        </li>
        <li className="flex items-start gap-2">
          <span style={STYLES.colorPrimary}>•</span>
          <span>{t('help:tips.halfBinMode')}</span>
        </li>
      </ul>
    </section>
  );
}

// Blocked zones section
function BlockedZonesSection() {
  const { t } = useTranslation(['help']);
  return (
    <section>
      <h3 className="mb-4" style={{ ...STYLES.sectionHeader, fontSize: 'var(--text-lg)' }}>
        {t('help:blockedZones.title')}
      </h3>
      <div className="p-4 rounded-lg" style={STYLES.blockedZonesContent}>
        <p className="mb-3">
          <strong style={STYLES.textPrimary}>{t('help:blockedZones.whatAre')}</strong>
        </p>
        <p className="mb-3">
          {t('help:blockedZones.explanation')}
        </p>
        <p>
          <strong style={STYLES.textPrimary}>{t('help:blockedZones.exampleLabel')}</strong> {t('help:blockedZones.example')}
        </p>
      </div>
    </section>
  );
}

// Bin clearance section
function BinClearanceSection() {
  const { t } = useTranslation(['help']);
  return (
    <section>
      <h3 className="mb-4" style={{ ...STYLES.sectionHeader, fontSize: 'var(--text-lg)' }}>
        {t('help:clearance.title')}
      </h3>
      <div className="p-4 rounded-lg" style={STYLES.blockedZonesContent}>
        <p className="mb-3">
          <strong style={STYLES.textPrimary}>{t('help:clearance.whatIs')}</strong>
        </p>
        <p className="mb-3">
          {t('help:clearance.explanation')}
        </p>
        <p className="mb-3">
          <strong style={STYLES.textPrimary}>{t('help:clearance.exampleLabel')}</strong> {t('help:clearance.example')}
        </p>
        <p>
          {t('help:clearance.howToSet')}
        </p>
      </div>
    </section>
  );
}

// Category icons
function CommandIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function NavigationIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function MouseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  );
}

function TouchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
    </svg>
  );
}
