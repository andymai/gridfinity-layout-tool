import { describe, it, expect } from 'vitest';
import { getCommandDescriptionKey } from './commandDescriptions';

describe('commandDescriptions', () => {
  describe('getCommandDescriptionKey', () => {
    it('returns correct i18n key for bin commands', () => {
      expect(getCommandDescriptionKey('bin.add')).toBe('undo.binAdded');
      expect(getCommandDescriptionKey('bin.update')).toBe('undo.binUpdated');
      expect(getCommandDescriptionKey('bin.delete')).toBe('undo.binDeleted');
      expect(getCommandDescriptionKey('bin.deleteBatch')).toBe('undo.binsDeleted');
      expect(getCommandDescriptionKey('bin.duplicate')).toBe('undo.binDuplicated');
    });

    it('returns correct i18n key for layer commands', () => {
      expect(getCommandDescriptionKey('layer.add')).toBe('undo.layerAdded');
      expect(getCommandDescriptionKey('layer.update')).toBe('undo.layerUpdated');
      expect(getCommandDescriptionKey('layer.delete')).toBe('undo.layerDeleted');
      expect(getCommandDescriptionKey('layer.reorder')).toBe('undo.layersReordered');
    });

    it('returns correct i18n key for category commands', () => {
      expect(getCommandDescriptionKey('category.add')).toBe('undo.categoryAdded');
      expect(getCommandDescriptionKey('category.update')).toBe('undo.categoryUpdated');
      expect(getCommandDescriptionKey('category.delete')).toBe('undo.categoryDeleted');
    });

    it('returns correct i18n key for drawer commands', () => {
      expect(getCommandDescriptionKey('drawer.update')).toBe('undo.drawerUpdated');
    });

    it('returns correct i18n key for layout setting commands', () => {
      expect(getCommandDescriptionKey('layout.setName')).toBe('undo.nameChanged');
      expect(getCommandDescriptionKey('layout.setPrintBedSize')).toBe('undo.printBedSizeChanged');
      expect(getCommandDescriptionKey('layout.setGridUnitMm')).toBe('undo.gridUnitChanged');
      expect(getCommandDescriptionKey('layout.setHeightUnitMm')).toBe('undo.heightUnitChanged');
      expect(getCommandDescriptionKey('layout.setBaseplateParams')).toBe(
        'undo.baseplateParamsChanged'
      );
    });

    it('returns a counted key for several bin commands of one type', () => {
      expect(getCommandDescriptionKey('bin.update', 3)).toBe('undo.binsUpdatedCount');
      expect(getCommandDescriptionKey('bin.add', 2)).toBe('undo.binsAddedCount');
      expect(getCommandDescriptionKey('bin.delete', 2)).toBe('undo.binsDeletedCount');
      expect(getCommandDescriptionKey('bin.duplicate', 2)).toBe('undo.binsDuplicatedCount');
      expect(getCommandDescriptionKey('bin.moveToStaging', 2)).toBe('undo.binsMovedToStagingCount');
      expect(getCommandDescriptionKey('bin.moveFromStaging', 2)).toBe(
        'undo.binsMovedFromStagingCount'
      );
    });

    it('keeps the single key for one command, or for a command with no counted key', () => {
      expect(getCommandDescriptionKey('bin.update', 1)).toBe('undo.binUpdated');
      expect(getCommandDescriptionKey('drawer.update', 3)).toBe('undo.drawerUpdated');
      expect(getCommandDescriptionKey('bin.deleteBatch', 2)).toBe('undo.binsDeleted');
    });

    it('returns unknown action key for "unknown" type', () => {
      expect(getCommandDescriptionKey('unknown')).toBe('undo.unknownAction');
    });

    it('returns unknown action key for unmapped command types', () => {
      // Use a valid but unmapped type to test the fallback
      expect(getCommandDescriptionKey('library.import' as 'bin.add')).toBe('undo.unknownAction');
    });
  });
});
