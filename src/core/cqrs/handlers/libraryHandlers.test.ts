import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { createCommand } from '../commands';
import { resetVersionCounters } from './index';
import type { LayoutId, LayoutEntry, LayoutPreview, CloudShareInfo } from '@/core/types';

// --- Mocks ---

const testLayoutId = 'layout_1' as LayoutId;
const testPreview: LayoutPreview = {
  drawerWidth: 6,
  drawerDepth: 4,
  drawerHeight: 7,
  binCount: 0,
  layerCount: 1,
};

const testEntry: LayoutEntry = {
  id: testLayoutId,
  name: 'Test Layout',
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  preview: testPreview,
};

const entries: LayoutEntry[] = [testEntry];

const mockLibraryStore = {
  library: {
    activeLayoutId: testLayoutId,
    entries,
    version: '1.0' as const,
    settings: { authorName: 'Test Author' },
  },
  isLoaded: true,
  createEntry: vi.fn(
    (name: string, layoutId: LayoutId, preview: LayoutPreview) =>
      ({
        id: layoutId,
        name,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview,
      }) as LayoutEntry
  ),
  deleteEntry: vi.fn(() => ({ ok: true, value: undefined })),
  updateEntry: vi.fn(),
  duplicateEntry: vi.fn(
    (_sourceEntry: LayoutEntry, newLayoutId: LayoutId) =>
      ({
        id: newLayoutId,
        name: 'Test Layout (copy)',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: testPreview,
      }) as LayoutEntry
  ),
  getEntry: vi.fn((id: LayoutId) => entries.find((e) => e.id === id)),
  setActiveLayoutId: vi.fn(),
  setAuthorName: vi.fn(),
  setCloudShare: vi.fn(),
  clearCloudShare: vi.fn(),
};

vi.mock('@/core/store/library', () => ({
  useLibraryStore: { getState: () => mockLibraryStore },
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: {
    getState: () => ({ layout: { bins: [], layers: [], categories: [] } }),
  },
}));

vi.mock('@/shared/utils', () => ({
  generateLayoutId: () => 'layout_new' as LayoutId,
}));

vi.mock('@/core/storage', () => ({
  computePreview: () => testPreview,
}));

const {
  handleCreateEntry,
  handleDeleteEntry,
  handleDuplicateEntry,
  handleSwitchActive,
  handleUpdateEntry,
  handleSetAuthorName,
  handleSetCloudShare,
  handleClearCloudShare,
  handleRenameEntry,
} = await import('./libraryHandlers');

describe('Library Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVersionCounters();
    entries.length = 0;
    entries.push({ ...testEntry });
  });

  describe('handleCreateEntry', () => {
    it('creates entry and produces entryCreated event', () => {
      const cmd = createCommand('library.createEntry', { name: 'New Layout' });
      const result = handleCreateEntry(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(1);
        expect(result.value.events[0].type).toBe('library.entryCreated');
        expect(mockLibraryStore.createEntry).toHaveBeenCalledWith(
          'New Layout',
          expect.any(String),
          expect.any(Object)
        );
      }
    });
  });

  describe('handleDeleteEntry', () => {
    it('deletes entry and produces entryDeleted event', () => {
      const cmd = createCommand('library.deleteEntry', { layoutId: testLayoutId });
      const result = handleDeleteEntry(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events[0].type).toBe('library.entryDeleted');
      }
    });

    it('returns error when delete fails', () => {
      mockLibraryStore.deleteEntry.mockReturnValueOnce({
        ok: false,
        error: { code: 'LAYOUT_LAST_ENTITY', message: 'Cannot delete last layout' },
      });
      const cmd = createCommand('library.deleteEntry', { layoutId: testLayoutId });
      const result = handleDeleteEntry(cmd);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('handleDuplicateEntry', () => {
    it('returns error when source layout not found', () => {
      const cmd = createCommand('library.duplicateEntry', {
        sourceLayoutId: 'nonexistent' as LayoutId,
      });
      const result = handleDuplicateEntry(cmd);

      expect(isErr(result)).toBe(true);
    });

    it('duplicates entry and produces entryDuplicated event', () => {
      const cmd = createCommand('library.duplicateEntry', {
        sourceLayoutId: testLayoutId,
      });
      const result = handleDuplicateEntry(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events[0].type).toBe('library.entryDuplicated');
        expect(result.value.events[0].payload).toEqual(
          expect.objectContaining({ sourceLayoutId: testLayoutId })
        );
      }
    });
  });

  describe('handleSwitchActive', () => {
    it('switches active layout and produces event', () => {
      const newId = 'layout_2' as LayoutId;
      const cmd = createCommand('library.switchActive', { layoutId: newId });
      const result = handleSwitchActive(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events[0].type).toBe('library.activeLayoutSwitched');
        expect(result.value.events[0].payload).toEqual({
          previousLayoutId: testLayoutId,
          newLayoutId: newId,
        });
      }
    });
  });

  describe('handleUpdateEntry', () => {
    it('updates entry and produces entryUpdated event', () => {
      const cmd = createCommand('library.updateEntry', {
        layoutId: testLayoutId,
        updates: { name: 'Updated Name' },
      });
      const result = handleUpdateEntry(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events[0].type).toBe('library.entryUpdated');
      }
    });
  });

  describe('handleSetAuthorName', () => {
    it('sets author name and produces event with previous name', () => {
      const cmd = createCommand('library.setAuthorName', { name: 'New Author' });
      const result = handleSetAuthorName(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events[0].type).toBe('library.authorNameSet');
        expect(result.value.events[0].payload).toEqual({
          name: 'New Author',
          previousName: 'Test Author',
        });
      }
    });
  });

  describe('handleSetCloudShare', () => {
    it('sets cloud share and produces event', () => {
      const shareInfo = { id: 'share_1', url: 'https://example.com' } as CloudShareInfo;
      const cmd = createCommand('library.setCloudShare', {
        layoutId: testLayoutId,
        shareInfo,
      });
      const result = handleSetCloudShare(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events[0].type).toBe('library.cloudShareUpdated');
      }
    });
  });

  describe('handleClearCloudShare', () => {
    it('clears cloud share and produces event', () => {
      const cmd = createCommand('library.clearCloudShare', { layoutId: testLayoutId });
      const result = handleClearCloudShare(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events[0].type).toBe('library.cloudShareCleared');
      }
    });
  });

  describe('handleRenameEntry', () => {
    it('renames entry and produces event with previous name', () => {
      const cmd = createCommand('library.renameEntry', {
        layoutId: testLayoutId,
        name: 'Renamed Layout',
      });
      const result = handleRenameEntry(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events[0].type).toBe('library.entryRenamed');
        expect(result.value.events[0].payload).toEqual({
          layoutId: testLayoutId,
          name: 'Renamed Layout',
          previousName: 'Test Layout',
        });
      }
    });
  });
});
