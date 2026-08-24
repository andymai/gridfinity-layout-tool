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
import { ok, err, storageNotFound, storageUnavailable } from '@/core/result';
import type { Bin, Layout } from '@/core/types';
import { binId, designId, layerId, categoryId, gridUnits, heightUnits, mm } from '@/core/types';
import type { BinParams } from '@/features/bin-designer';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

// Mock modules
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  loadDesign: vi.fn(),
  deleteDesign: vi.fn(),
  updateDesignParams: vi.fn(),
}));

vi.mock('@/features/bin-designer/store/customBinRegistry', () => ({
  removeRegistryEntry: vi.fn(),
  upsertRegistryEntry: vi.fn(),
  registryEdgeFields: vi.fn(() => ({})),
  registryHeightFields: vi.fn(() => ({})),
  registryOverhangFields: vi.fn(() => ({})),
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

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: binId('bin-1'),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(2),
    depth: gridUnits(3),
    height: heightUnits(4),
    layerId: layerId('layer-1'),
    category: categoryId('cat-1'),
    label: '',
    notes: '',
    ...overrides,
  };
}

function makeLayout(bins: Bin[]): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(5) },
    layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(1) }],
    categories: [{ id: categoryId('cat-1'), name: 'Category 1', color: '#ff0000' }],
    bins,
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    printBedSize: mm(256),
  };
}

// Helper to build a valid BinParams fixture for design-linking tests, which
// only care about width/depth/height (and occasionally wallThickness).
function makeDesignParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...overrides,
  };
}

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
      const { mockUpdateBin } = setupStores([makeBin({ id: binId('bin-1') })]);
      vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([
        { id: 'design-1', name: 'Test Design' } as never,
      ]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.linkBin(binId('bin-1'), designId('design-1'));
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: 'design-1' });
    });

    it('shows success toast when design is found in registry', () => {
      const { mockAddToast } = setupStores([makeBin({ id: binId('bin-1') })]);
      vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([
        { id: 'design-1', name: 'Test Design' } as never,
      ]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.linkBin(binId('bin-1'), designId('design-1'));
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
        result.current.linkBin(binId('nonexistent-bin'), designId('design-1'));
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });
  });

  describe('unlinkBin', () => {
    it('unlinks a bin from its design', () => {
      const { mockUpdateBin } = setupStores([
        makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') }),
      ]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBin(binId('bin-1'));
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: null });
    });

    it('shows info toast when unlinking', () => {
      const { mockAddToast } = setupStores([
        makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') }),
      ]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBin(binId('bin-1'));
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
        result.current.unlinkBin(binId('nonexistent-bin'));
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });

    it('does nothing if bin has no linkedDesignId', () => {
      const { mockUpdateBin } = setupStores([makeBin({ id: binId('bin-1') })]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBin(binId('bin-1'));
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });
  });

  describe('unlinkBins', () => {
    it('unlinks multiple bins', () => {
      const { mockUpdateBin } = setupStores([
        makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') }),
        makeBin({ id: binId('bin-2'), linkedDesignId: designId('design-1') }),
      ]);

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.unlinkBins([binId('bin-1'), binId('bin-2')]);
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: null });
      expect(mockUpdateBin).toHaveBeenCalledWith('bin-2', { linkedDesignId: null });
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
        result.current.editLinkedDesign(designId('design-1'));
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
        result.current.editLinkedDesign(designId('design with spaces'));
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
      setupStores([
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          label: 'Test Bin',
        }),
      ]);
      const mockShowCreateDialog = vi.fn();
      useLinkingStore.setState({ showCreateDesignDialog: mockShowCreateDialog });

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.showCreateDesignDialog(binId('bin-1'));
      });

      expect(mockShowCreateDialog).toHaveBeenCalledWith(
        'bin-1',
        expect.any(String), // Generated name
        { width: 2, depth: 3, height: 4 },
        'Test Bin'
      );
    });

    it('passes undefined label when bin has no label', () => {
      setupStores([makeBin({ id: binId('bin-1'), label: '' })]);
      const mockShowCreateDialog = vi.fn();
      useLinkingStore.setState({ showCreateDesignDialog: mockShowCreateDialog });

      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.showCreateDesignDialog(binId('bin-1'));
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
        result.current.showCreateDesignDialog(binId('nonexistent-bin'));
      });

      expect(mockShowCreateDialog).not.toHaveBeenCalled();
    });
  });

  describe('promptSyncIfNeeded', () => {
    it('shows error toast if design fails to load', async () => {
      const { mockAddToast } = setupStores([makeBin({ id: binId('bin-1') })]);
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(err(storageNotFound('design-1')));

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded([binId('bin-1')], designId('design-1'));
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.any(String),
        type: 'error',
        duration: 3000,
      });
    });

    it('shows info toast when dimensions match', async () => {
      const { mockAddToast } = setupStores([
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
        }),
      ]);
      const mockParams: BinParams = makeDesignParams({
        width: 2,
        depth: 3,
        height: 4,
        wallThickness: 0.8,
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded([binId('bin-1')], designId('design-1'));
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.any(String),
        type: 'info',
        duration: 2000,
      });
    });

    it('shows sync dialog when dimensions differ', async () => {
      setupStores([
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
        }),
      ]);
      const mockParams: BinParams = makeDesignParams({
        width: 3,
        depth: 3,
        height: 4,
        wallThickness: 0.8,
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));
      const mockShowSyncDialog = vi.fn();
      useLinkingStore.setState({ showSyncDialog: mockShowSyncDialog });

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded([binId('bin-1')], designId('design-1'));
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
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
        }),
        makeBin({
          id: binId('bin-2'),
          width: gridUnits(3),
          depth: gridUnits(3),
          height: heightUnits(4),
        }),
      ]);
      const mockParams: BinParams = makeDesignParams({
        width: 2,
        depth: 3,
        height: 4,
        wallThickness: 0.8,
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));
      const mockShowSyncDialog = vi.fn();
      useLinkingStore.setState({ showSyncDialog: mockShowSyncDialog });

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.promptSyncIfNeeded(
          [binId('bin-1'), binId('bin-2')],
          designId('design-1')
        );
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
        await result.current.promptSyncIfNeeded([], designId('design-1'));
      });

      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });
  });

  describe('executeSyncFromDesign', () => {
    it('syncs bins with matching dimensions', async () => {
      const { mockUpdateBin } = setupStores([
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          x: gridUnits(0),
          y: gridUnits(0),
        }),
      ]);
      const mockParams: BinParams = makeDesignParams({
        width: 3,
        depth: 3,
        height: 5,
        wallThickness: 0.8,
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));

      const { result } = renderHook(() => useBinLinking());

      let syncResult: Awaited<ReturnType<typeof result.current.executeSyncFromDesign>>;
      await act(async () => {
        syncResult = await result.current.executeSyncFromDesign(
          [binId('bin-1')],
          designId('design-1')
        );
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
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          x: gridUnits(0),
          y: gridUnits(0),
        }),
        makeBin({
          id: binId('bin-2'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          x: gridUnits(2),
          y: gridUnits(0),
        }), // Adjacent
      ]);
      const mockParams: BinParams = makeDesignParams({
        width: 5, // Too wide, would collide with bin-2
        depth: 3,
        height: 5,
        wallThickness: 0.8,
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));

      const { result } = renderHook(() => useBinLinking());

      const syncResult = await act(async () => {
        return await result.current.executeSyncFromDesign([binId('bin-1')], designId('design-1'));
      });

      // Bin should be unlinked because it can't fit
      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: null });
      expect(syncResult.unlinked).toContain('bin-1');
      expect(syncResult.synced).toHaveLength(0);
    });

    it('returns empty result if design fails to load', async () => {
      setupStores([makeBin({ id: binId('bin-1') })]);
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(err(storageNotFound('design-1')));

      const { result } = renderHook(() => useBinLinking());

      const syncResult = await act(async () => {
        return await result.current.executeSyncFromDesign([binId('bin-1')], designId('design-1'));
      });

      expect(syncResult).toEqual({
        synced: [],
        unlinked: [],
        totalLinked: 1,
      });
    });

    it('shows success toast when all bins synced', async () => {
      const { mockAddToast } = setupStores([
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          x: gridUnits(0),
          y: gridUnits(0),
        }),
      ]);
      const mockParams: BinParams = makeDesignParams({
        width: 2,
        depth: 3,
        height: 5,
        wallThickness: 0.8,
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.executeSyncFromDesign([binId('bin-1')], designId('design-1'));
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
        result.current.navigateToCreateDesign(binId('bin-1'), 'Test Design', 2, 3, 4);
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
        result.current.navigateToCreateDesign(binId('bin-1'), 'Test', 2, 3, 4);
      });

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(PopStateEvent));
    });

    /** Place `bin-1` at `x` in a drawer of `drawerWidth`, half column on the left. */
    function withPlacedBin(x: number, drawerWidth: number) {
      setupStores([makeBin({ id: binId('bin-1'), x: gridUnits(x), width: gridUnits(1.5) })]);
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          drawer: {
            ...layout.drawer,
            width: gridUnits(drawerWidth),
            fractionalEdgeX: 'start',
          },
        },
      });
    }

    it('threads the edge implied by the placement into the URL', () => {
      // Cells start at 0.5 in a 10.5-wide start-fractional drawer, so a bin at
      // x=0 opens with its half cell.
      withPlacedBin(0, 10.5);
      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.navigateToCreateDesign(binId('bin-1'), 'Half', 1.5, 3, 4);
      });

      expect(pushStateSpy.mock.calls[0][2]).toContain('fractionalEdgeX=start');
    });

    it('reads the position, not the drawer edge, in a whole-number drawer (#3070)', () => {
      // No half column exists on X here, so the drawer's 'start' setting is
      // meaningless — a bin at x=0 carries its half cell at the end.
      withPlacedBin(0, 10);
      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.navigateToCreateDesign(binId('bin-1'), 'Half', 1.5, 3, 4);
      });

      expect(pushStateSpy.mock.calls[0][2]).toContain('fractionalEdgeX=end');
    });

    it('omits the edge for an integer dimension', () => {
      withPlacedBin(0, 10.5);
      const { result } = renderHook(() => useBinLinking());

      act(() => {
        result.current.navigateToCreateDesign(binId('bin-1'), 'Whole', 2, 3, 4);
      });

      expect(pushStateSpy.mock.calls[0][2]).not.toContain('fractionalEdgeX');
    });
  });

  describe('deleteLinkedDesign', () => {
    it('unlinks bin and deletes design successfully', async () => {
      const { mockUpdateBin, mockAddToast } = setupStores([
        makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') }),
      ]);
      vi.mocked(DesignerStorage.deleteDesign).mockResolvedValue(ok(undefined));

      const { result } = renderHook(() => useBinLinking());

      let success: boolean;
      await act(async () => {
        success = await result.current.deleteLinkedDesign(
          binId('bin-1'),
          designId('design-1'),
          'Test Design'
        );
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: null });
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
      const { mockAddToast } = setupStores([
        makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') }),
      ]);
      vi.mocked(DesignerStorage.deleteDesign).mockResolvedValue(
        err(storageUnavailable('indexedDB'))
      );

      const { result } = renderHook(() => useBinLinking());

      const success = await act(async () => {
        return await result.current.deleteLinkedDesign(
          binId('bin-1'),
          designId('design-1'),
          'Test Design'
        );
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        message: expect.any(String),
        type: 'error',
        duration: 4000,
      });
      expect(success).toBe(false);
    });

    it('still unlinks bin even if deletion fails', async () => {
      const { mockUpdateBin } = setupStores([
        makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') }),
      ]);
      vi.mocked(DesignerStorage.deleteDesign).mockResolvedValue(
        err(storageUnavailable('indexedDB'))
      );

      const { result } = renderHook(() => useBinLinking());

      await act(async () => {
        await result.current.deleteLinkedDesign(
          binId('bin-1'),
          designId('design-1'),
          'Test Design'
        );
      });

      expect(mockUpdateBin).toHaveBeenCalledWith('bin-1', { linkedDesignId: null });
    });
  });

  describe('matchDesignEdgesToDrawer', () => {
    /**
     * A 10.5-wide drawer with its half column on the left (cells start at 0.5)
     * and `design-1` placed at x=0, so the bin's half cell lands at 'start'.
     * The design has to be PLACED — the edge follows the bin's position, not
     * the drawer's own fractional slot.
     */
    function withDrawerEdge() {
      const stores = setupStores([
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(1.5),
          linkedDesignId: designId('design-1'),
        }),
      ]);
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          drawer: { ...layout.drawer, width: gridUnits(10.5), fractionalEdgeX: 'start' },
        },
      });
      return stores;
    }

    it('realigns fractional edges to the drawer and clears that axis manual flag', async () => {
      const { mockAddToast } = withDrawerEdge();
      const mockParams = {
        width: 1.5,
        depth: 2,
        height: 3,
        fractionalEdgeX: 'end',
        fractionalEdgeManualX: true,
      };
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));
      vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(
        ok({ id: 'design-1', name: 'Design', updatedAt: '2026-01-01T00:00:00.000Z' } as never)
      );

      const { result } = renderHook(() => useBinLinking());
      await act(async () => {
        await result.current.matchDesignEdgesToDrawer(designId('design-1'), binId('bin-1'));
      });

      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
        'design-1',
        expect.objectContaining({ fractionalEdgeX: 'start', fractionalEdgeManualX: false })
      );
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('matches the bin the user clicked, not the first placement of the design', async () => {
      // Two bins on one design, half a unit apart, so their half cells land on
      // opposite sides. Acting from bin-2's inspector has to use bin-2.
      setupStores([
        makeBin({
          id: binId('bin-1'),
          x: gridUnits(0),
          width: gridUnits(1.5),
          linkedDesignId: designId('design-1'),
        }),
        makeBin({
          id: binId('bin-2'),
          x: gridUnits(0.5),
          width: gridUnits(1.5),
          linkedDesignId: designId('design-1'),
        }),
      ]);
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: { ...layout, drawer: { ...layout.drawer, width: gridUnits(10) } },
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(
        ok({ params: { width: 1.5, depth: 2, height: 3, fractionalEdgeX: 'end' } } as never)
      );
      vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(
        ok({ id: 'design-1', name: 'Design', updatedAt: '2026-01-01T00:00:00.000Z' } as never)
      );

      const { result } = renderHook(() => useBinLinking());
      await act(async () => {
        await result.current.matchDesignEdgesToDrawer(designId('design-1'), binId('bin-2'));
      });

      // bin-1 (x=0) wants 'end', bin-2 (x=0.5) wants 'start' — no consensus,
      // so the stored edge is written back untouched.
      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
        'design-1',
        expect.objectContaining({ fractionalEdgeX: 'end' })
      );
    });

    it('matches every placement when they all agree', async () => {
      setupStores([
        makeBin({
          id: binId('bin-1'),
          x: gridUnits(0.5),
          width: gridUnits(1.5),
          linkedDesignId: designId('design-1'),
        }),
        makeBin({
          id: binId('bin-2'),
          x: gridUnits(2.5),
          width: gridUnits(1.5),
          linkedDesignId: designId('design-1'),
        }),
      ]);
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: { ...layout, drawer: { ...layout.drawer, width: gridUnits(10) } },
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(
        ok({ params: { width: 1.5, depth: 2, height: 3, fractionalEdgeX: 'end' } } as never)
      );
      vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(
        ok({ id: 'design-1', name: 'Design', updatedAt: '2026-01-01T00:00:00.000Z' } as never)
      );

      const { result } = renderHook(() => useBinLinking());
      await act(async () => {
        await result.current.matchDesignEdgesToDrawer(designId('design-1'), binId('bin-1'));
      });

      // Both sit at half offsets, so both want 'start'.
      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
        'design-1',
        expect.objectContaining({ fractionalEdgeX: 'start' })
      );
    });

    it('does nothing when the bin was unlinked while the design was loading', async () => {
      withDrawerEdge();
      vi.mocked(DesignerStorage.loadDesign).mockImplementation(async () => {
        // Simulate the user unlinking mid-read.
        const l = useLayoutStore.getState().layout;
        useLayoutStore.setState({
          layout: { ...l, bins: l.bins.map((b) => ({ ...b, linkedDesignId: undefined })) },
        });
        return ok({ params: { width: 1.5, depth: 2, height: 3, fractionalEdgeX: 'end' } } as never);
      });

      const { result } = renderHook(() => useBinLinking());
      await act(async () => {
        await result.current.matchDesignEdgesToDrawer(designId('design-1'), binId('bin-1'));
      });

      expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();
    });

    it('does not reverse a correct foot in a whole-number drawer (#3070)', async () => {
      withDrawerEdge();
      const layout = useLayoutStore.getState().layout;
      // Whole-number width: no half column, so the drawer's 'start' setting
      // says nothing. The bin at x=0 carries its half cell at the end, which is
      // what the design already has — matching must leave it alone.
      useLayoutStore.setState({
        layout: { ...layout, drawer: { ...layout.drawer, width: gridUnits(10) } },
      });
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(
        ok({ params: { width: 1.5, depth: 2, height: 3, fractionalEdgeX: 'end' } } as never)
      );
      vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(
        ok({ id: 'design-1', name: 'Design', updatedAt: '2026-01-01T00:00:00.000Z' } as never)
      );

      const { result } = renderHook(() => useBinLinking());
      await act(async () => {
        await result.current.matchDesignEdgesToDrawer(designId('design-1'), binId('bin-1'));
      });

      expect(DesignerStorage.updateDesignParams).toHaveBeenCalledWith(
        'design-1',
        expect.objectContaining({ fractionalEdgeX: 'end' })
      );
    });

    it('shows an error toast when the design fails to load', async () => {
      const { mockAddToast } = withDrawerEdge();
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(err(storageNotFound('design-1')));

      const { result } = renderHook(() => useBinLinking());
      await act(async () => {
        await result.current.matchDesignEdgesToDrawer(designId('design-1'), binId('bin-1'));
      });

      expect(DesignerStorage.updateDesignParams).not.toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });

    it('shows an error toast when the update fails', async () => {
      const { mockAddToast } = withDrawerEdge();
      const mockParams = { width: 1.5, depth: 2, height: 3, fractionalEdgeX: 'end' };
      vi.mocked(DesignerStorage.loadDesign).mockResolvedValue(ok({ params: mockParams } as never));
      vi.mocked(DesignerStorage.updateDesignParams).mockResolvedValue(
        err(storageUnavailable('indexedDB'))
      );

      const { result } = renderHook(() => useBinLinking());
      await act(async () => {
        await result.current.matchDesignEdgesToDrawer(designId('design-1'), binId('bin-1'));
      });

      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });
});
