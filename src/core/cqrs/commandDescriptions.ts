/**
 * Maps command types to i18n keys for undo/redo toast descriptions.
 *
 * Used by the history store to show what action is being undone/redone.
 */

import type { CommandType } from './commands';

const DESCRIPTIONS: Readonly<Partial<Record<CommandType, string>>> = {
  'bin.add': 'undo.binAdded',
  'bin.update': 'undo.binUpdated',
  'bin.delete': 'undo.binDeleted',
  'bin.deleteBatch': 'undo.binsDeleted',
  'bin.duplicate': 'undo.binDuplicated',
  'bin.moveToStaging': 'undo.binMovedToStaging',
  'bin.moveToStagingBatch': 'undo.binsMovedToStaging',
  'bin.restoreFromStaging': 'undo.binsMovedFromStaging',
  'bin.moveFromStaging': 'undo.binMovedFromStaging',
  'bin.fillLayer': 'undo.layerFilled',
  'bin.fillGaps': 'undo.gapsFilled',
  'bin.expandToFit': 'undo.binsExpanded',
  'bin.clearLayer': 'undo.layerCleared',
  'layer.add': 'undo.layerAdded',
  'layer.update': 'undo.layerUpdated',
  'layer.delete': 'undo.layerDeleted',
  'layer.reorder': 'undo.layersReordered',
  'category.add': 'undo.categoryAdded',
  'category.update': 'undo.categoryUpdated',
  'category.delete': 'undo.categoryDeleted',
  'drawer.update': 'undo.drawerUpdated',
  'drawer.setOutline': 'undo.drawerOutlineSet',
  'layout.setName': 'undo.nameChanged',
  'layout.setPrintBedSize': 'undo.printBedSizeChanged',
  'layout.setGridUnitMm': 'undo.gridUnitChanged',
  'layout.setGridUnitMmY': 'undo.gridUnitChanged',
  'layout.setMagnetAnchor': 'undo.magnetAnchorChanged',
  'layout.setLowProfileBase': 'undo.lowProfileBaseChanged',
  'layout.setHeightUnitMm': 'undo.heightUnitChanged',
  'layout.setBaseplateParams': 'undo.baseplateParamsChanged',
  'layout.setActiveBaseplate': 'undo.activeBaseplateChanged',
};

/** Plural families for a batch that ran several commands of one type, each on its own bin. */
const COUNTED_DESCRIPTIONS: Readonly<Partial<Record<CommandType, string>>> = {
  'bin.add': 'undo.binsAddedCount',
  'bin.update': 'undo.binsUpdatedCount',
  'bin.delete': 'undo.binsDeletedCount',
  'bin.duplicate': 'undo.binsDuplicatedCount',
  'bin.moveToStaging': 'undo.binsMovedToStagingCount',
  'bin.moveFromStaging': 'undo.binsMovedFromStagingCount',
};

export function getCommandDescriptionKey(
  commandType: CommandType | 'unknown',
  commandCount = 1
): string {
  if (commandType === 'unknown') return 'undo.unknownAction';
  const counted = commandCount > 1 ? COUNTED_DESCRIPTIONS[commandType] : undefined;
  return counted ?? DESCRIPTIONS[commandType] ?? 'undo.unknownAction';
}
