import { describe, it, expect } from 'vitest';
import { getMiddlewareFlags } from './middlewareConfig';

describe('getMiddlewareFlags', () => {
  it('returns domain profile for existing bin commands', () => {
    const flags = getMiddlewareFlags('bin.add');
    expect(flags).toEqual({ validation: true, undo: true });
  });

  it('returns domain profile for all existing 23 domain commands', () => {
    const domainCommands = [
      'bin.add',
      'bin.update',
      'bin.delete',
      'bin.deleteBatch',
      'bin.duplicate',
      'bin.moveToStaging',
      'bin.moveFromStaging',
      'bin.fillLayer',
      'bin.fillGaps',
      'bin.clearLayer',
      'layer.add',
      'layer.update',
      'layer.delete',
      'layer.reorder',
      'category.add',
      'category.update',
      'category.delete',
      'drawer.update',
      'layout.setName',
      'layout.setPrintBedSize',
      'layout.setGridUnitMm',
      'layout.setHeightUnitMm',
      'layout.setBaseplateParams',
    ] as const;

    for (const cmd of domainCommands) {
      const flags = getMiddlewareFlags(cmd);
      expect(flags.undo, `${cmd} should have undo=true`).toBe(true);
      expect(flags.validation, `${cmd} should have validation=true`).toBe(true);
    }
  });

  it('returns library profile for library commands', () => {
    const flags = getMiddlewareFlags('library.createEntry');
    expect(flags).toEqual({ validation: true, undo: false });
  });

  it('returns library profile for all library commands', () => {
    const libraryCommands = [
      'library.createEntry',
      'library.deleteEntry',
      'library.duplicateEntry',
      'library.switchActive',
      'library.updateEntry',
      'library.setAuthorName',
      'library.setCloudShare',
      'library.clearCloudShare',
      'library.renameEntry',
      'library.importLayout',
    ] as const;

    for (const cmd of libraryCommands) {
      const flags = getMiddlewareFlags(cmd);
      expect(flags.undo, `${cmd} should have undo=false`).toBe(false);
      expect(flags.validation, `${cmd} should have validation=true`).toBe(true);
    }
  });

  it('returns ui profile for UI commands', () => {
    const flags = getMiddlewareFlags('ui.pageView');
    expect(flags).toEqual({ validation: false, undo: false });
  });

  it('returns restore profile for layout.restore', () => {
    const flags = getMiddlewareFlags('layout.restore');
    expect(flags).toEqual({ validation: false, undo: false });
  });

  it('returns designer profile for designer.save', () => {
    const flags = getMiddlewareFlags('designer.save');
    expect(flags).toEqual({ validation: true, undo: false });
  });
});
