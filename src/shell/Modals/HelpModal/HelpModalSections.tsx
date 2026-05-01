/**
 * Sub-components rendered inside the Help modal:
 *   - shortcut presentation (`KeyboardKey`, `ShortcutRow`, `ShortcutCategorySection`)
 *   - the static read-only sections in the "Tips" tab (`TipsSection`,
 *     `BlockedZonesSection`, `BinClearanceSection`)
 *   - the always-visible-on-desktop input recap
 *     (`MouseInteractionsSection`) and tablet add-on (`TouchGesturesSection`)
 */

import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { STYLES, KEY_SEPARATOR, type ShortcutCategory } from './helpModalStyles';
import { HelpCategoryIcon } from './helpModalShortcutData';

/** Enhanced keyboard key component */
export function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium rounded border border-stroke bg-gradient-to-b from-surface-elevated to-surface text-content shadow-[0_1px_0_1px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
      {children}
    </kbd>
  );
}

export function ShortcutRow({
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

/** Shortcut category section component */
export function ShortcutCategorySection({
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

/** Mouse interactions section */
export function MouseInteractionsSection() {
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

/** Touch gestures section */
export function TouchGesturesSection() {
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

/** Tips tab — bullet list of usage hints. */
const TIP_KEYS = [
  'help.tip.binPalette',
  'help.tip.autoSplit',
  'help.tip.dragLayers',
  'help.tip.renameLayers',
  'help.tip.autoSave',
  'help.tip.quickOpen',
  'help.tip.halfBin',
] as const;

export function TipsSection() {
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

/** Blocked zones section */
export function BlockedZonesSection() {
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

/** Bin clearance section */
export function BinClearanceSection() {
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
