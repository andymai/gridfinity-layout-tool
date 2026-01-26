/**
 * Command registry for the command palette.
 *
 * Commands are defined separately from their handlers to allow
 * the registry to be built at runtime with access to stores and actions.
 */

import type { CommandCategory } from './types';
import { SHORTCUTS } from '@/core/constants';

/** Category labels (i18n keys) */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: 'commandPalette.category.navigation',
  edit: 'commandPalette.category.edit',
  layers: 'commandPalette.category.layers',
  view: 'commandPalette.category.view',
  preview: 'commandPalette.category.preview',
  bins: 'commandPalette.category.bins',
  tools: 'commandPalette.category.tools',
  export: 'commandPalette.category.export',
};

/** Category display order */
export const CATEGORY_ORDER: CommandCategory[] = [
  'navigation',
  'edit',
  'layers',
  'view',
  'preview',
  'bins',
  'tools',
  'export',
];

/**
 * Format shortcut keys for display.
 * Converts array to joined string if needed.
 */
export function formatShortcutKeys(keys: string | readonly string[]): string {
  if (Array.isArray(keys)) {
    return keys.join(' / ');
  }
  return keys as string;
}

/**
 * Command definition (without action, which is wired up at runtime).
 * This allows the registry to be type-safe while actions are provided by the component.
 */
export interface CommandDefinition {
  id: string;
  labelKey: string;
  category: CommandCategory;
  shortcut?: {
    keys: string | string[];
    modifier?: boolean;
  };
  keywords?: string[];
}

/**
 * Static command definitions.
 * Actions are wired up in the CommandPalette component where stores are available.
 */
export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  // === Navigation ===
  {
    id: 'open-layout-manager',
    labelKey: 'commandPalette.openLayoutManager',
    category: 'navigation',
    shortcut: { keys: SHORTCUTS.LAYOUT_MANAGER.toUpperCase(), modifier: true },
    keywords: ['layouts', 'switch', 'browse'],
  },
  {
    id: 'open-settings',
    labelKey: 'commandPalette.openSettings',
    category: 'navigation',
    keywords: ['preferences', 'options', 'configure'],
  },
  {
    id: 'open-help',
    labelKey: 'commandPalette.openHelp',
    category: 'navigation',
    shortcut: { keys: formatShortcutKeys(SHORTCUTS.HELP) },
    keywords: ['shortcuts', 'keyboard', 'documentation'],
  },
  {
    id: 'open-print',
    labelKey: 'commandPalette.openPrint',
    category: 'navigation',
    keywords: ['export', 'pdf'],
  },

  // === Edit ===
  {
    id: 'undo',
    labelKey: 'commandPalette.undo',
    category: 'edit',
    shortcut: { keys: SHORTCUTS.UNDO.toUpperCase(), modifier: true },
  },
  {
    id: 'redo',
    labelKey: 'commandPalette.redo',
    category: 'edit',
    shortcut: { keys: SHORTCUTS.REDO.toUpperCase(), modifier: true },
  },
  {
    id: 'delete-selected',
    labelKey: 'commandPalette.deleteSelected',
    category: 'edit',
    shortcut: { keys: formatShortcutKeys(SHORTCUTS.DELETE) },
    keywords: ['remove', 'trash'],
  },
  {
    id: 'duplicate-selected',
    labelKey: 'commandPalette.duplicateSelected',
    category: 'edit',
    shortcut: { keys: SHORTCUTS.DUPLICATE.toUpperCase(), modifier: true },
    keywords: ['copy', 'clone'],
  },
  {
    id: 'rotate-bin',
    labelKey: 'commandPalette.rotateBin',
    category: 'edit',
    shortcut: { keys: SHORTCUTS.ROTATE.toUpperCase() },
    keywords: ['flip', 'turn', 'swap'],
  },
  {
    id: 'quick-label',
    labelKey: 'commandPalette.quickLabel',
    category: 'edit',
    shortcut: { keys: SHORTCUTS.QUICK_LABEL.toUpperCase() },
    keywords: ['name', 'rename', 'text'],
  },
  {
    id: 'clear-selection',
    labelKey: 'commandPalette.clearSelection',
    category: 'edit',
    shortcut: { keys: formatShortcutKeys(SHORTCUTS.ESCAPE) },
    keywords: ['deselect', 'none'],
  },

  // === Layers ===
  {
    id: 'add-layer',
    labelKey: 'commandPalette.addLayer',
    category: 'layers',
    keywords: ['new', 'create'],
  },
  {
    id: 'layer-up',
    labelKey: 'commandPalette.layerUp',
    category: 'layers',
    shortcut: { keys: SHORTCUTS.LAYER_UP.toUpperCase() },
    keywords: ['next', 'above'],
  },
  {
    id: 'layer-down',
    labelKey: 'commandPalette.layerDown',
    category: 'layers',
    shortcut: { keys: SHORTCUTS.LAYER_DOWN.toUpperCase() },
    keywords: ['previous', 'below'],
  },
  {
    id: 'clear-layer',
    labelKey: 'commandPalette.clearLayer',
    category: 'layers',
    keywords: ['remove all', 'empty'],
  },

  // === View ===
  {
    id: 'zoom-in',
    labelKey: 'commandPalette.zoomIn',
    category: 'view',
    shortcut: { keys: formatShortcutKeys(SHORTCUTS.ZOOM_IN) },
    keywords: ['magnify', 'bigger'],
  },
  {
    id: 'zoom-out',
    labelKey: 'commandPalette.zoomOut',
    category: 'view',
    shortcut: { keys: formatShortcutKeys(SHORTCUTS.ZOOM_OUT) },
    keywords: ['shrink', 'smaller'],
  },
  {
    id: 'fit-to-screen',
    labelKey: 'commandPalette.fitToScreen',
    category: 'view',
    keywords: ['reset zoom', 'center'],
  },
  {
    id: 'toggle-labels',
    labelKey: 'commandPalette.toggleLabels',
    category: 'view',
    keywords: ['show', 'hide', 'text'],
  },
  {
    id: 'toggle-other-layers',
    labelKey: 'commandPalette.toggleOtherLayers',
    category: 'view',
    keywords: ['show', 'hide', 'visibility'],
  },

  // === 3D Preview ===
  {
    id: 'toggle-preview',
    labelKey: 'commandPalette.togglePreview',
    category: 'preview',
    shortcut: { keys: SHORTCUTS.PREVIEW_TOGGLE.toUpperCase() },
    keywords: ['3d', 'isometric'],
  },
  {
    id: 'expand-preview',
    labelKey: 'commandPalette.expandPreview',
    category: 'preview',
    shortcut: { keys: 'Space' },
    keywords: ['fullscreen', 'maximize'],
  },
  {
    id: 'camera-isometric',
    labelKey: 'commandPalette.cameraIsometric',
    category: 'preview',
    shortcut: { keys: SHORTCUTS.PRESET_ISOMETRIC },
    keywords: ['angle', 'diagonal'],
  },
  {
    id: 'camera-top',
    labelKey: 'commandPalette.cameraTop',
    category: 'preview',
    shortcut: { keys: SHORTCUTS.PRESET_TOP },
    keywords: ['overhead', 'above'],
  },
  {
    id: 'camera-front',
    labelKey: 'commandPalette.cameraFront',
    category: 'preview',
    shortcut: { keys: SHORTCUTS.PRESET_FRONT },
    keywords: ['face'],
  },
  {
    id: 'camera-side',
    labelKey: 'commandPalette.cameraSide',
    category: 'preview',
    shortcut: { keys: SHORTCUTS.PRESET_SIDE },
    keywords: ['profile', 'lateral'],
  },

  // === Bins ===
  {
    id: 'prev-bin',
    labelKey: 'commandPalette.prevBin',
    category: 'bins',
    shortcut: { keys: SHORTCUTS.SELECT_PREV_BIN.toUpperCase() },
    keywords: ['previous', 'back'],
  },
  {
    id: 'next-bin',
    labelKey: 'commandPalette.nextBin',
    category: 'bins',
    shortcut: { keys: SHORTCUTS.SELECT_NEXT_BIN.toUpperCase() },
    keywords: ['forward'],
  },
  {
    id: 'prev-category',
    labelKey: 'commandPalette.prevCategory',
    category: 'bins',
    shortcut: { keys: SHORTCUTS.CATEGORY_PREV },
  },
  {
    id: 'next-category',
    labelKey: 'commandPalette.nextCategory',
    category: 'bins',
    shortcut: { keys: SHORTCUTS.CATEGORY_NEXT },
  },
  {
    id: 'move-to-stash',
    labelKey: 'commandPalette.moveToStash',
    category: 'bins',
    keywords: ['staging', 'temporary', 'hold'],
  },

  // === Tools ===
  {
    id: 'toggle-half-bin',
    labelKey: 'commandPalette.toggleHalfBin',
    category: 'tools',
    shortcut: { keys: SHORTCUTS.HALF_BIN_TOGGLE.toUpperCase() },
    keywords: ['0.5', 'fractional', 'precision'],
  },
  {
    id: 'fill-gaps',
    labelKey: 'commandPalette.fillGaps',
    category: 'tools',
    keywords: ['auto', 'complete'],
  },
  {
    id: 'suggest-layout-name',
    labelKey: 'commandPalette.suggestLayoutName',
    category: 'tools',
    keywords: ['name', 'rename', 'auto', 'suggest', 'title'],
  },

  // === Export ===
  {
    id: 'download-layout',
    labelKey: 'commandPalette.downloadLayout',
    category: 'export',
    keywords: ['save', 'file', 'json'],
  },
  {
    id: 'copy-share-link',
    labelKey: 'commandPalette.copyShareLink',
    category: 'export',
    keywords: ['url', 'share'],
  },
  // === Selection ===
  {
    id: 'select-all',
    labelKey: 'commandPalette.selectAll',
    category: 'edit',
    shortcut: { keys: 'A', modifier: true },
    keywords: ['all', 'layer', 'bins'],
  },
  {
    id: 'select-none',
    labelKey: 'commandPalette.selectNone',
    category: 'edit',
    keywords: ['deselect', 'clear', 'none'],
  },
  {
    id: 'invert-selection',
    labelKey: 'commandPalette.invertSelection',
    category: 'edit',
    keywords: ['reverse', 'opposite', 'toggle'],
  },
  {
    id: 'select-by-category',
    labelKey: 'commandPalette.selectByCategory',
    category: 'edit',
    keywords: ['filter', 'group', 'same category'],
  },

  // === Layout Management ===
  {
    id: 'new-layout',
    labelKey: 'commandPalette.newLayout',
    category: 'navigation',
    shortcut: { keys: 'N', modifier: true },
    keywords: ['create', 'blank', 'fresh'],
  },
  {
    id: 'duplicate-layout',
    labelKey: 'commandPalette.duplicateLayout',
    category: 'navigation',
    keywords: ['copy', 'clone', 'layout'],
  },

  // === Tools ===
  {
    id: 'toggle-paint-mode',
    labelKey: 'commandPalette.togglePaintMode',
    category: 'tools',
    shortcut: { keys: 'P' },
    keywords: ['paint', 'brush', 'fill', 'rapid'],
  },
  {
    id: 'fill-layer',
    labelKey: 'commandPalette.fillLayer',
    category: 'tools',
    keywords: ['fill', 'uniform', 'complete', 'auto'],
  },

  // === Staging ===
  {
    id: 'clear-staging',
    labelKey: 'commandPalette.clearStaging',
    category: 'bins',
    keywords: ['stash', 'empty', 'remove'],
  },
  {
    id: 'restore-from-staging',
    labelKey: 'commandPalette.restoreFromStaging',
    category: 'bins',
    keywords: ['unstash', 'bring back', 'recover'],
  },
];
