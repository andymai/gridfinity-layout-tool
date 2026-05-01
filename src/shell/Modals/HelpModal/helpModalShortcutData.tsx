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
import { formatKey, type ShortcutCategory } from './helpModalStyles';

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

export { HelpCategoryIcon };
