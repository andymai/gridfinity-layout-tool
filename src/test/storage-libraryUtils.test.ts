import { describe, it, expect } from 'vitest';
import { expectOk, expectErr } from '@/test/testUtils';
import {
  findLibraryEntry,
  findLibraryEntryResult,
  updateLibraryEntryAtIndex,
  updateLibraryEntryById,
  removeLibraryEntry,
  addLibraryEntry,
} from '../core/storage/libraryUtils';
import type { LayoutEntry, LayoutLibrary } from '../core/types';

const createMockEntry = (id: string, name: string): LayoutEntry => ({
  id,
  name,
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  preview: {
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
    binMap: '',
  },
});

const createMockLibrary = (entries: LayoutEntry[]): LayoutLibrary => ({
  version: 1,
  activeLayoutId: entries[0]?.id ?? 'none',
  settings: {},
  entries,
});

describe('libraryUtils', () => {
  describe('findLibraryEntry', () => {
    it('finds existing entry', () => {
      const entries = [
        createMockEntry('layout-1', 'First'),
        createMockEntry('layout-2', 'Second'),
        createMockEntry('layout-3', 'Third'),
      ];
      const library = createMockLibrary(entries);

      const result = findLibraryEntry(library, 'layout-2');

      expect(result).not.toBeNull();
      expect(result?.entry.id).toBe('layout-2');
      expect(result?.entry.name).toBe('Second');
      expect(result?.index).toBe(1);
    });

    it('returns null for non-existent entry', () => {
      const library = createMockLibrary([createMockEntry('layout-1', 'First')]);

      const result = findLibraryEntry(library, 'layout-999');

      expect(result).toBeNull();
    });

    it('returns null for empty library', () => {
      const library = createMockLibrary([]);

      const result = findLibraryEntry(library, 'any-id');

      expect(result).toBeNull();
    });
  });

  describe('findLibraryEntryResult', () => {
    it('returns Ok for existing entry', () => {
      const library = createMockLibrary([createMockEntry('layout-1', 'First')]);

      const result = findLibraryEntryResult(library, 'layout-1');

      const value = expectOk(result);
      expect(value.entry.id).toBe('layout-1');
      expect(value.index).toBe(0);
    });

    it('returns Err for non-existent entry', () => {
      const library = createMockLibrary([createMockEntry('layout-1', 'First')]);

      const result = findLibraryEntryResult(library, 'layout-999');

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_NOT_FOUND');
    });
  });

  describe('updateLibraryEntryAtIndex', () => {
    it('updates entry at specified index', () => {
      const entries = [createMockEntry('layout-1', 'First'), createMockEntry('layout-2', 'Second')];
      const library = createMockLibrary(entries);

      const result = updateLibraryEntryAtIndex(library, 1, { name: 'Updated' });

      expect(result.entries[0].name).toBe('First');
      expect(result.entries[1].name).toBe('Updated');
      expect(result.entries[1].id).toBe('layout-2'); // ID preserved
    });

    it('does not mutate original library', () => {
      const entries = [createMockEntry('layout-1', 'Original')];
      const library = createMockLibrary(entries);

      const result = updateLibraryEntryAtIndex(library, 0, { name: 'Updated' });

      expect(library.entries[0].name).toBe('Original');
      expect(result.entries[0].name).toBe('Updated');
    });

    it('can update multiple fields', () => {
      const entries = [createMockEntry('layout-1', 'First')];
      const library = createMockLibrary(entries);
      const now = Date.now();

      const result = updateLibraryEntryAtIndex(library, 0, {
        name: 'Updated',
        modifiedAt: now,
      });

      expect(result.entries[0].name).toBe('Updated');
      expect(result.entries[0].modifiedAt).toBe(now);
    });
  });

  describe('updateLibraryEntryById', () => {
    it('updates entry by ID', () => {
      const entries = [createMockEntry('layout-1', 'First'), createMockEntry('layout-2', 'Second')];
      const library = createMockLibrary(entries);

      const result = updateLibraryEntryById(library, 'layout-2', {
        name: 'Updated Second',
      });

      const value = expectOk(result);
      expect(value.entries[1].name).toBe('Updated Second');
    });

    it('returns error for non-existent ID', () => {
      const library = createMockLibrary([createMockEntry('layout-1', 'First')]);

      const result = updateLibraryEntryById(library, 'layout-999', {
        name: 'Updated',
      });

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_NOT_FOUND');
    });
  });

  describe('removeLibraryEntry', () => {
    it('removes entry by ID', () => {
      const entries = [
        createMockEntry('layout-1', 'First'),
        createMockEntry('layout-2', 'Second'),
        createMockEntry('layout-3', 'Third'),
      ];
      const library = createMockLibrary(entries);

      const result = removeLibraryEntry(library, 'layout-2');

      const value = expectOk(result);
      expect(value.entries).toHaveLength(2);
      expect(value.entries[0].id).toBe('layout-1');
      expect(value.entries[1].id).toBe('layout-3');
    });

    it('returns error for non-existent ID', () => {
      const library = createMockLibrary([createMockEntry('layout-1', 'First')]);

      const result = removeLibraryEntry(library, 'layout-999');

      const error = expectErr(result);
      expect(error.code).toBe('STORAGE_NOT_FOUND');
    });

    it('does not mutate original library', () => {
      const entries = [createMockEntry('layout-1', 'First'), createMockEntry('layout-2', 'Second')];
      const library = createMockLibrary(entries);

      const result = removeLibraryEntry(library, 'layout-2');

      expect(library.entries).toHaveLength(2);
      const value = expectOk(result);
      expect(value.entries).toHaveLength(1);
    });
  });

  describe('addLibraryEntry', () => {
    it('adds entry at start by default', () => {
      const library = createMockLibrary([createMockEntry('layout-1', 'First')]);
      const newEntry = createMockEntry('layout-new', 'New');

      const result = addLibraryEntry(library, newEntry);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].id).toBe('layout-new');
      expect(result.entries[1].id).toBe('layout-1');
    });

    it('adds entry at end when specified', () => {
      const library = createMockLibrary([createMockEntry('layout-1', 'First')]);
      const newEntry = createMockEntry('layout-new', 'New');

      const result = addLibraryEntry(library, newEntry, 'end');

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].id).toBe('layout-1');
      expect(result.entries[1].id).toBe('layout-new');
    });

    it('does not mutate original library', () => {
      const library = createMockLibrary([createMockEntry('layout-1', 'First')]);
      const newEntry = createMockEntry('layout-new', 'New');

      const result = addLibraryEntry(library, newEntry);

      expect(library.entries).toHaveLength(1);
      expect(result.entries).toHaveLength(2);
    });
  });
});
