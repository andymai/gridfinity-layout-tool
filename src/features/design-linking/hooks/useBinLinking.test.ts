/**
 * Tests for useBinLinking hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinLinking } from './useBinLinking';
import { useLayoutStore } from '@/core/store/layout';
import { useToastStore } from '@/core/store/toast';
import { useLinkingStore } from '../store';
import * as DesignerStorage from '@/features/bin-designer/storage/DesignerStorage';
import * as CustomBinRegistry from '@/features/bin-designer/store/customBinRegistry';
import * as MutationsContext from '@/shared/contexts/MutationsContext';
import * as UseCustomBins from '@/features/bin-designer/hooks/useCustomBins';
import { ok, err } from '@/core/result';
import type { Bin, Layout } from '@/core/types';
import type { BinParameters } from '@/features/bin-designer/types';

// Mock modules
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  loadDesign: vi.fn(),
  deleteDesign: vi.fn(),
}));

vi.mock('@/features/bin-designer/store/customBinRegistry', () => ({
  removeRegistryEntry: vi.fn(),
}));

vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: vi.fn(),
}));

vi.mock('@/features/bin-designer/hooks/useCustomBins', () => ({
  useCustomBins: vi.fn(),
}));

// Mock window methods with proper spies
let pushStateSpy: ReturnType<typeof vi.spyOn>;
let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
  dispatchEventSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
});

// Helper to create test bin
function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin-1',
    x: 0,
    y: 0,
    width: 2,
    depth: 3,
    height: 4,
    layerId: 'layer-1',
    category: 'cat-1',
    label: '',
    notes: '',
    ...overrides,
  };
}

// Helper to create test layout
function makeLayout(bins: Bin[]): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 10, height: 5 },
    layers: [{ id: 'layer-1', name: 'Layer 1', height: 1 }],
    categories: [{ id: 'cat-1', name: 'Category 1', color: '#ff0000' }],
    bins,
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
  };
}

// Helper to set up stores
function setupStores(bins: Bin[]) {
  const mockUpdateBin = vi.fn();
  const mockExecute = vi.fn((fn) => fn());
  const mockAddToast = vi.fn();

  useLayoutStore.setState({ layout: makeLayout(bins) });
  useToastStore.setState({ addToast: mockAddToast, toasts: [] });
  useLinkingStore.setState({
    showSyncDialog: vi.fn(),
    showCreateDesignDialog: vi.fn(),
    hideCreateDesignDialog: vi.fn(),
    hideSyncDialog: vi.fn(),
    showDeleteWarning: vi.fn(),
    hideDeleteWarning: vi.fn(),
    showLinkDesignDialog: vi.fn(),
    hideLinkDesignDialog: vi.fn(),
    pendingSync: null,
    pendingCreateDesign: null,
    pendingLinkDesign: null,
    pendingDeleteWarning: null,
  });

  vi.mocked(MutationsContext.useMutations).mockReturnValue({
    updateBin: mockUpdateBin,
    execute: mockExecute,
  } as never);

  vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([]);

  return { mockUpdateBin, mockExecute, mockAddToast };
}

describe('useBinLinking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('linkBin', () => {
    it('links a bin to a design', () => {
      const { mockUpdateBin } = setupStores([makeBin({ id: 'bin-1' })]);
      vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([
        { id: 'design-1', name: 'Test Design' } as never,
      ]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.linkBin('bin-1', 'design-1');
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: 'design-1' });
    });

    it('shows success toast when design is found in registry', () => {
      const { mockAddToast } = setupStores([makeBin({ id: 'bin-1' })]);
      vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([
        { id: 'design-1', name: 'Test Design' } as never,
      ]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.linkBin('bin-1', 'design-1');
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.stringContaining('Test Design'),
        type: 'success',
        duration: 2000,
      });
    });

    it('does nothing if bin not found', () => {
      const { mockUpdateBin } = setupStores([]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.linkBin('nonexistent-bin', 'design-1');
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });
  });

  describe('unlinkBin', () => {
    it('unlinks a bin from its design', () => {
      const { mockUpdateBin } = setupStores([makeBin({ id: 'bin-1', linkedDesignId: 'design-1' })]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBin('bin-1');
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: undefined });
    });

    it('shows info toast when unlinking', () => {
      const { mockAddToast } = setupStores([makeBin({ id: 'bin-1', linkedDesignId: 'design-1' })]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBin('bin-1');
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.any(String),
        type: 'info',
        duration: 2000,
      });
    });

    it('does nothing if bin not found', () => {
      const { mockUpdateBin } = setupStores([]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBin('nonexistent-bin');
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });

    it('does nothing if bin has no linkedDesignId', () => {
      const { mockUpdateBin } = setupStores([makeBin({ id: 'bin-1' })]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBin('bin-1');
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });
  });

  describe('unlinkBins', () => {
    it('unlinks multiple bins', () => {
      const { mockUpdateBin } = setupStores([
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-1' }),
      ]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBins(['bin-1', 'bin-2']);
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: undefined });
      expect(mockUpdateBin).toHaveBeenCalledWith('bin-2', { linkedDesignId: undefined });
    });

    it('handles empty array', () => {
      const { mockUpdateBin } = setupStores([]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBins([]);
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });
  });

  describe('editLinkedDesign', () => {
    it('navigates to designer with correct URL', () => {
      setupStores([]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.editLinkedDesign('design-1');
      });

      expect(pushStateSpy).toHaveBeenCalledWith(
        { designId: 'design-1' },
        '',
        '/designer?id=design-1'
      );
      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(PopStateEvent));
    });

    it('properly encodes design ID in URL', () => {
      setupStores([]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.editLinkedDesign('design with spaces');
      });

      expect(pushStateSpy).toHaveBeenCalledWith(
        { designId: 'design with spaces' },
        '',
        '/designer?id=design%20with%20spaces'
      );
    });
  });

  describe('showCreateDesignDialog', () => {
    it('shows create dialog with bin dimensions', () => {
      setupStores([makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, label: 'Test Bin' })]);
      const mockShowCreateDialog = vi.fn();
      useLinkingStore.setState({ showCreateDesignDialog: mockShowCreateDialog });

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.showCreateDesignDialog('bin-1');
      });

      expect(mockShowCreateDialog).toHaveBeenCalledWith(
        'bin-1',
        expect.any(String), // Generated name
        { width: 2, depth: 3, height: 4 },
        'Test Bin'
      );
    });

    it('passes undefined label when bin has no label', () => {
      setupStores([makeBin({ id: 'bin-1', label: '' })]);
      const mockShowCreateDialog = vi.fn();
      useLinkingStore.setState({ showCreateDesignDialog: mockShowCreateDialog });

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.showCreateDesignDialog('bin-1');
      });

      expect(mockShowCreateDialog).toHaveBeenCalledWith(
        'bin-1',
        expect.any(String),
        expect.any(Object),
        undefined
      );
    });

    it('does nothing if bin not found', () => {
      setupStores([]);
      const mockShowCreateDialog = vi.fn();
      useLinkingStore.setState({ showCreateDesignDialog: mockShowCreateDialog });

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.showCreateDesignDialog('nonexistent-bin');
      });

      expect(mockShowCreateDialog).not.toHaveBeenCalled();
    });
  });

  describe('promptSyncIfNeeded', () => {
    it('shows error toast if design fails to load', async () => {
      const { mockAddToast } = setupStores([makeBin({ id: 'bin-1' })]);
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(err({ type: 'not_found' }));

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded(['bin-1'], 'design-1');
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.any(String),
        type: 'error',
        duration: 3000,
      });
    });

    it('shows info toast when dimensions match', async () => {
      const { mockAddToast } = setupStores([
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4 }),
      ]);
      const mockParams: BinParameters = {
        width: 2,
        depth: 3,
        height: 4,
        wallThickness: 0.8,
        baseStyle: 'plain',
        baseHeight: 4,
      };
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded(['bin-1'], 'design-1');
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.any(String),
        type: 'info',
        duration: 2000,
      });
    });

    it('shows sync dialog when dimensions differ', async () => {
      setupStores([makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4 })]);
      const mockParams: BinParameters = {
        width: 3,
        depth: 3,
        height: 4,
        wallThickness: 0.8,
        baseStyle: 'plain',
        baseHeight: 4,
      };
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));
      const mockShowSyncDialog = vi.fn();
      useLinkingStore.setState({ showSyncDialog: mockShowSyncDialog });

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded(['bin-1'], 'design-1');
      });

      expect(mockShowSyncDialog).toHaveBeenCalledWith(
        ['bin-1'],
        'design-1',
        expect.any(String),
        expect.objectContaining({ matched: false }),
        expect.any(Array),
        false
      );
    });

    it('detects varying dimensions in multi-bin selection', async () => {
      setupStores([
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4 }),
        makeBin({ id: 'bin-2', width: 3, depth: 3, height: 4 }),
      ]);
      const mockParams: BinParameters = {
        width: 2,
        depth: 3,
        height: 4,
        wallThickness: 0.8,
        baseStyle: 'plain',
        baseHeight: 4,
      };
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));
      const mockShowSyncDialog = vi.fn();
      useLinkingStore.setState({ showSyncDialog: mockShowSyncDialog });

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded(['bin-1', 'bin-2'], 'design-1');
      });

      expect(mockShowSyncDialog).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.any(Array),
        true // binsHaveVaryingDimensions
      );
    });

    it('does nothing if no bins provided', async () => {
      setupStores([]);
      const mockShowSyncDialog = vi.fn();
      useLinkingStore.setState({ showSyncDialog: mockShowSyncDialog });

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded([], 'design-1');
      });

      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });
  });

  describe('executeSyncFromDesign', () => {
    it('syncs bins with matching dimensions', async () => {
      const { mockUpdateBin } = setupStores([
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, x: 0, y: 0 }),
      ]);
      const mockParams: BinParameters = {
        width: 3,
        depth: 3,
        height: 5,
        wallThickness: 0.8,
        baseStyle: 'plain',
        baseHeight: 4,
      };
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));

      const { result } = renderHook(() => useBinLinking());

      let syncResult: Awaited<ReturnType<typeof result.current.executeSyncFromDesign>>;
      await act(async () => {
        syncResult = await result.current.executeSyncFromDesign(['bin-1'], 'design-1');
      });

      expect(mockUpdateBin).toHaveBeenCalledWith(
        'bin-1',
        expect.objectContaining({
          width: 3,
          depth: 3,
          height: 5,
        })
      );
      expect(syncResult!.synced).toContain('bin-1');
      expect(syncResult!.unlinked).toHaveLength(0);
    });

    it('unlinks bins that cannot sync due to collision', async () => {
      const { mockUpdateBin } = setupStores([
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, x: 0, y: 0 }),
        makeBin({ id: 'bin-2', width: 2, depth: 3, height: 4, x: 2, y: 0 }), // Adjacent
      ]);
      const mockParams: BinParameters = {
        width: 5, // Too wide, would collide with bin-2
        depth: 3,
        height: 5,
        wallThickness: 0.8,
        baseStyle: 'plain',
        baseHeight: 4,
      };
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));

      const { result } = renderHook(() => useBinLinking());

      const syncResult = await act(async () => {
        return await result.current.executeSyncFromDesign(['bin-1'], 'design-1');
      });

      // Bin should be unlinked because it can't fit
      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: undefined });
      expect(syncResult.unlinked).toContain('bin-1');
      expect(syncResult.synced).toHaveLength(0);
    });

    it('returns empty result if design fails to load', async () => {
      setupStores([makeBin({ id: 'bin-1' })]);
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(err({ type: 'not_found' }));

      const { result } = renderHook(() => useBinLinking());

      const syncResult = await act(async () => {
        return await result.current.executeSyncFromDesign(['bin-1'], 'design-1');
      });

      expect(syncResult).toEqual({
        synced: [],
        unlinked: [],
        totalLinked: 1,
      });
    });

    it('shows success toast when all bins synced', async () => {
      const { mockAddToast } = setupStores([
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, x: 0, y: 0 }),
      ]);
      const mockParams: BinParameters = {
        width: 2,
        depth: 3,
        height: 5,
        wallThickness: 0.8,
        baseStyle: 'plain',
        baseHeight: 4,
      };
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.executeSyncFromDesign(['bin-1'], 'design-1');
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.any(String),
        type: 'success',
        duration: 2000,
      });
    });
  });

  describe('navigateToCreateDesign', () => {
    it('navigates to designer with create params', () => {
      setupStores([]);
      const mockHideCreateDialog = vi.fn();
      useLinkingStore.setState({ hideCreateDesignDialog: mockHideCreateDialog });

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.navigateToCreateDesign('bin-1', 'Test Design', 2, 3, 4);
      });

      expect(mockHideCreateDialog).toHaveBeenCalled();
      expect(pushStateSpy).toHaveBeenCalledWith(null, '', expect.stringContaining('/designer?'));
      const callArg = pushStateSpy.mock.calls[0][2];
      expect(callArg).toContain('createFrom=bin');
      expect(callArg).toContain('linkBin=bin-1');
      expect(callArg).toContain('name=Test+Design');
      expect(callArg).toContain('width=2');
      expect(callArg).toContain('depth=3');
      expect(callArg).toContain('height=4');
    });

    it('dispatches popstate event after navigation', () => {
      setupStores([]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.navigateToCreateDesign('bin-1', 'Test', 2, 3, 4);
      });

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(PopStateEvent));
    });
  });

  describe('deleteLinkedDesign', () => {
    it('unlinks bin and deletes design successfully', async () => {
      const { mockUpdateBin, mockAddToast } = setupStores([
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
      ]);
      vi.mocked(DesignerStorage.deleteDesign).mockResolvedValue(ok(undefined));

      const { result } = renderHook(() => useBinLinking());

      let success: boolean;
      await act(async () => {
        success = await result.current.deleteLinkedDesign('bin-1', 'design-1', 'Test Design');
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: undefined });
      expect(DesignerStorage.deleteDesign).toHaveBeenCalledWith('design-1');
      expect(CustomBinRegistry.removeRegistryEntry).toHaveBeenCalledWith('design-1');
      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.stringContaining('Test Design'),
        type: 'success',
        duration: 3000,
      });
      expect(success!).toBe(true);
    });

    it('shows error toast if deletion fails', async () => {
      const { mockAddToast } = setupStores([makeBin({ id: 'bin-1', linkedDesignId: 'design-1' })]);
      vi.mocked(DesignerStorage.deleteDesign).mockResolvedValue(err({ type: 'unknown' }));

      const { result } = renderHook(() => useBinLinking());

      const success = await act(async () => {
        return await result.current.deleteLinkedDesign('bin-1', 'design-1', 'Test Design');
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.any(String),
        type: 'error',
        duration: 4000,
      });
      expect(success).toBe(false);
    });

    it('still unlinks bin even if deletion fails', async () => {
      const { mockUpdateBin } = setupStores([makeBin({ id: 'bin-1', linkedDesignId: 'design-1' })]);
      vi.mocked(DesignerStorage.deleteDesign).mockResolvedValue(err({ type: 'unknown' }));

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.deleteLinkedDesign('bin-1', 'design-1', 'Test Design');
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: undefined });
    });
  });
});
