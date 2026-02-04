/**
 * useCutoutLibrary hook tests.
 *
 * Tests the library management hook for cutout templates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCutoutLibrary } from './useCutoutLibrary';
import * as storage from '../storage';
import { ok, err } from '@/core/result';
import { storageError } from '../types';
import type { CutoutTemplate, TracedContour } from '../types';

// Mock the storage module
vi.mock('../storage', () => ({
  saveCutoutTemplate: vi.fn(),
  loadCutoutTemplates: vi.fn(),
  deleteCutoutTemplate: vi.fn(),
  updateCutoutTemplate: vi.fn(),
  generateUniqueName: vi.fn(),
}));

function createTestContour(): TracedContour {
  return {
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    boundingBox: { width: 100, height: 100 },
    area: 0.8,
  };
}

function createTestTemplate(overrides: Partial<CutoutTemplate> = {}): CutoutTemplate {
  return {
    id: 'test-id-1',
    name: 'Test Wrench',
    contour: createTestContour(),
    thumbnail: 'data:image/jpeg;base64,thumb',
    originalImage: 'data:image/png;base64,original',
    widthMm: 150,
    heightMm: 40,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useCutoutLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.loadCutoutTemplates).mockResolvedValue([]);
    vi.mocked(storage.saveCutoutTemplate).mockResolvedValue(ok('new-id'));
    vi.mocked(storage.deleteCutoutTemplate).mockResolvedValue();
    vi.mocked(storage.updateCutoutTemplate).mockResolvedValue(ok(undefined));
    vi.mocked(storage.generateUniqueName).mockImplementation(async (name) => name);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with loading state', () => {
      const { result } = renderHook(() => useCutoutLibrary());

      // Initially loading
      expect(result.current.isLoading).toBe(true);
    });

    it('loads templates on mount', async () => {
      const templates = [createTestTemplate()];
      vi.mocked(storage.loadCutoutTemplates).mockResolvedValue(templates);

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toEqual(templates);
    });

    it('sets error if loading fails', async () => {
      vi.mocked(storage.loadCutoutTemplates).mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Load failed');
    });
  });

  describe('saveTemplate', () => {
    it('saves a new template', async () => {
      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveTemplate(
          'New Wrench',
          createTestContour(),
          'data:image/png;base64,img',
          150,
          40
        );
      });

      expect(storage.saveCutoutTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Wrench',
          widthMm: 150,
          heightMm: 40,
        })
      );
    });

    it('generates unique name for duplicates', async () => {
      vi.mocked(storage.generateUniqueName).mockResolvedValue('Wrench (2)');

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveTemplate('Wrench', createTestContour(), null, 150, 40);
      });

      expect(storage.generateUniqueName).toHaveBeenCalledWith('Wrench');
      expect(storage.saveCutoutTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Wrench (2)' })
      );
    });

    it('refreshes templates after save', async () => {
      const initialTemplates: CutoutTemplate[] = [];
      const afterSaveTemplates = [createTestTemplate()];

      vi.mocked(storage.loadCutoutTemplates)
        .mockResolvedValueOnce(initialTemplates)
        .mockResolvedValueOnce(afterSaveTemplates);

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(0);

      await act(async () => {
        await result.current.saveTemplate('Test', createTestContour(), null, 100, 50);
      });

      expect(result.current.templates).toHaveLength(1);
    });

    it('sets error on save failure', async () => {
      vi.mocked(storage.saveCutoutTemplate).mockResolvedValue(err(storageError.storageFull(100)));

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveTemplate('Test', createTestContour(), null, 100, 50);
      });

      expect(result.current.error).toContain('maximum');
    });

    it('saves with optional category', async () => {
      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveTemplate(
          'Screwdriver',
          createTestContour(),
          null,
          200,
          30,
          'hand-tools'
        );
      });

      expect(storage.saveCutoutTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'hand-tools' })
      );
    });
  });

  describe('deleteTemplate', () => {
    it('deletes a template by ID', async () => {
      const templates = [createTestTemplate({ id: 'to-delete' })];
      vi.mocked(storage.loadCutoutTemplates).mockResolvedValue(templates);

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteTemplate('to-delete');
      });

      expect(storage.deleteCutoutTemplate).toHaveBeenCalledWith('to-delete');
    });

    it('refreshes templates after delete', async () => {
      const initialTemplates = [createTestTemplate({ id: 'to-delete' })];
      const afterDeleteTemplates: CutoutTemplate[] = [];

      vi.mocked(storage.loadCutoutTemplates)
        .mockResolvedValueOnce(initialTemplates)
        .mockResolvedValueOnce(afterDeleteTemplates);

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.templates).toHaveLength(1);
      });

      await act(async () => {
        await result.current.deleteTemplate('to-delete');
      });

      expect(result.current.templates).toHaveLength(0);
    });
  });

  describe('updateTemplate', () => {
    it('updates template properties', async () => {
      const templates = [createTestTemplate({ id: 'to-update', name: 'Old Name' })];
      vi.mocked(storage.loadCutoutTemplates).mockResolvedValue(templates);

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateTemplate('to-update', { name: 'New Name' });
      });

      expect(storage.updateCutoutTemplate).toHaveBeenCalledWith('to-update', {
        name: 'New Name',
      });
    });

    it('refreshes templates after update', async () => {
      const initialTemplates = [createTestTemplate({ id: 'to-update', name: 'Old' })];
      const afterUpdateTemplates = [createTestTemplate({ id: 'to-update', name: 'New' })];

      vi.mocked(storage.loadCutoutTemplates)
        .mockResolvedValueOnce(initialTemplates)
        .mockResolvedValueOnce(afterUpdateTemplates);

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.templates[0].name).toBe('Old');
      });

      await act(async () => {
        await result.current.updateTemplate('to-update', { name: 'New' });
      });

      expect(result.current.templates[0].name).toBe('New');
    });

    it('sets error on update failure', async () => {
      vi.mocked(storage.updateCutoutTemplate).mockResolvedValue(
        err(storageError.notFound('not-found'))
      );

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateTemplate('not-found', { name: 'New' });
      });

      expect(result.current.error).toContain('not found');
    });
  });

  describe('clearError', () => {
    it('clears the error state', async () => {
      vi.mocked(storage.loadCutoutTemplates).mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.error).toBe('Test error');
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('refresh', () => {
    it('manually refreshes templates', async () => {
      const { result } = renderHook(() => useCutoutLibrary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.mocked(storage.loadCutoutTemplates).mockResolvedValue([createTestTemplate()]);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.templates).toHaveLength(1);
    });
  });
});
