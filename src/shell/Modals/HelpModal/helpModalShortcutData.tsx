/* eslint-disable react-refresh/only-export-components -- this file co-locates the SHORTCUT_CATEGORIES catalog with the HelpCategoryIcon used inside it; splitting them adds nothing for fast-refresh since the catalog is module-scope data */

/**
 * The shortcut category catalog rendered in the Help modal's
 * "Shortcuts" tab.
 *
 * Each category bundles a translation-keyed name, an icon, and a list
 * of `ShortcutItem`s — the modal renders one section per category and
 * filters the list against the search query.
 */

import { SHORTCUTS } from '@/core/constants';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { formatShortcutKeys } from '@/shared/utils/shortcutKeys';
import type { ShortcutCategory } from './helpModalStyles';

function HelpCategoryIcon({ paths }: { paths: readonly string[] }) {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

// Define shortcut categories using translation keys
export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    id: 'general',
    nameKey: 'help.category.general',
    icon: <HelpCategoryIcon paths={ICON_PATHS.menu} />,
    shortcuts: [
      { keys: 'K', descriptionKey: 'help.shortcut.commandPalette', modifier: true },
      { keys: formatShortcutKeys(SHORTCUTS.UNDO), descriptionKey: 'common.undo', modifier: true },
      { keys: formatShortcutKeys(SHORTCUTS.REDO), descriptionKey: 'common.redo', modifier: true },
      { keys: formatShortcutKeys(SHORTCUTS.HELP), descriptionKey: 'help.shortcut.showHelp' },
      {
        keys: formatShortcutKeys(SHORTCUTS.ESCAPE),
        descriptionKey: 'help.shortcut.cancelDeselect',
      },
      {
        keys: formatShortcutKeys(SHORTCUTS.TOOL_SWITCH),
        descriptionKey: 'help.shortcut.toolSwitch',
        shift: true,
      },
    ],
  },
  {
    id: 'editing',
    nameKey: 'help.category.editing',
    icon: <HelpCategoryIcon paths={ICON_PATHS.edit} />,
    shortcuts: [
      { keys: 'D', descriptionKey: 'help.shortcut.duplicate', modifier: true },
      { keys: formatShortcutKeys(SHORTCUTS.DELETE), descriptionKey: 'help.shortcut.delete' },
      { keys: formatShortcutKeys(SHORTCUTS.ROTATE), descriptionKey: 'help.shortcut.rotate' },
      {
        keys: formatShortcutKeys(SHORTCUTS.QUICK_LABEL),
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
        keys: formatShortcutKeys(SHORTCUTS.LAYER_UP),
        descriptionKey: 'help.shortcut.layerUp',
      },
      {
        keys: formatShortcutKeys(SHORTCUTS.LAYER_DOWN),
        descriptionKey: 'help.shortcut.layerDown',
      },
      {
        keys: formatShortcutKeys(SHORTCUTS.SELECT_PREV_BIN),
        descriptionKey: 'help.shortcut.prevBin',
      },
      {
        keys: formatShortcutKeys(SHORTCUTS.SELECT_NEXT_BIN),
        descriptionKey: 'help.shortcut.nextBin',
      },
      {
        keys: formatShortcutKeys([SHORTCUTS.CATEGORY_PREV, SHORTCUTS.CATEGORY_NEXT]),
        descriptionKey: 'help.shortcut.cycleCategory',
      },
    ],
  },
  {
    id: 'view',
    nameKey: 'help.category.view',
    icon: <HelpCategoryIcon paths={ICON_PATHS.eye} />,
    shortcuts: [
      { keys: formatShortcutKeys(SHORTCUTS.ZOOM_IN), descriptionKey: 'help.shortcut.zoomIn' },
      { keys: formatShortcutKeys(SHORTCUTS.ZOOM_OUT), descriptionKey: 'help.shortcut.zoomOut' },
      { keys: 'O', descriptionKey: 'help.shortcut.openLayoutManager', modifier: true },
    ],
  },
  {
    id: '3d-preview',
    nameKey: 'help.category.preview3d',
    icon: <HelpCategoryIcon paths={ICON_PATHS.cube} />,
    shortcuts: [
      {
        keys: formatShortcutKeys(SHORTCUTS.PREVIEW_TOGGLE),
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
        keys: formatShortcutKeys(SHORTCUTS.HALF_BIN_TOGGLE),
        descriptionKey: 'help.shortcut.toggleHalfBin',
      },
      { keys: 'P', descriptionKey: 'help.shortcut.togglePaintMode' },
    ],
  },
];

export { HelpCategoryIcon };
