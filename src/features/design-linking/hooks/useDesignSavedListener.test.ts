/**
 * Tests for useDesignSavedListener hook
 *
 * Covers both mount-time reconciliation (catching design changes that occurred
 * while the listener was unmounted) and real-time event handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignSavedListener } from './useDesignSavedListener';
import { useLayoutStore } from '@/core/store/layout';
import { useToastStore } from '@/core/store/toast';
import { useLinkingStore } from '../store';
import { emitSyncEvent } from '@/shared/events/syncEventBus';
import * as MutationsContext from '@/shared/contexts/MutationsContext';
import * as UseCustomBins from '@/features/bin-designer/hooks/useCustomBins';
import type { Bin, Layout } from '@/core/types';
import { binId, designId, layerId, categoryId, gridUnits, heightUnits, mm } from '@/core/types';
import type { CustomBinRef } from '@/features/bin-designer';
import { err, ok } from '@/core/result';
import { commandBus, createCqrsMutations } from '@/core/cqrs';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { registerLinkedSlantResolver } from '@/shared/utils/placedSlant';

vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: vi.fn(),
}));

vi.mock('@/features/bin-designer/hooks/useCustomBins', () => ({
  useCustomBins: vi.fn(),
}));

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

function makeRegistryEntry(overrides: Partial<CustomBinRef> = {}): CustomBinRef {
  return {
    id: designId('design-1'),
    name: 'Test Design',
    width: 2,
    depth: 3,
    height: 4,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function setupStores(bins: Bin[], registryEntries: CustomBinRef[] = []) {
  const mockUpdateBin = vi.fn(() => ok(undefined));
  const mockExecute = vi.fn((fn: () => void) => fn());
  const mockAddToast = vi.fn();
  const mockShowSyncDialog = vi.fn();

  useLayoutStore.setState({ layout: makeLayout(bins) });
  useToastStore.setState({ addToast: mockAddToast, toasts: [] });
  useLinkingStore.setState({
    showSyncDialog: mockShowSyncDialog,
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
    declinedSyncs: {},
  });

  vi.mocked(MutationsContext.useMutations).mockReturnValue({
    updateBin: mockUpdateBin,
    execute: mockExecute,
  } as never);

  vi.mocked(UseCustomBins.useCustomBins).mockReturnValue(registryEntries);

  return { mockUpdateBin, mockExecute, mockAddToast, mockShowSyncDialog };
}

describe('useDesignSavedListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('mount-time reconciliation', () => {
    it('auto-syncs bins whose dimensions differ from registry', () => {
      const bins = [
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          linkedDesignId: designId('design-1'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 3, depth: 3, height: 5 }),
      ];
      const { mockUpdateBin, mockAddToast } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).toHaveBeenCalledWith(
        'bin-1',
        expect.objectContaining({ width: 3, depth: 3, height: 5 })
      );
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('does nothing when bin dimensions already match registry', () => {
      const bins = [
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          linkedDesignId: designId('design-1'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 2, depth: 3, height: 4 }),
      ];
      const { mockUpdateBin, mockShowSyncDialog } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });

    it('does nothing when there are no linked bins', () => {
      const bins = [makeBin({ id: binId('bin-1') })]; // No linkedDesignId
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 5, depth: 5, height: 5 }),
      ];
      const { mockUpdateBin, mockShowSyncDialog } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });

    it('does nothing when linked design is not in registry', () => {
      const bins = [makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-missing') })];
      const { mockUpdateBin, mockShowSyncDialog } = setupStores(bins, []);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });

    it('shows sync dialog when bins cannot fit new dimensions', () => {
      const bins = [
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          x: gridUnits(0),
          y: gridUnits(0),
          linkedDesignId: designId('design-1'),
        }),
        makeBin({
          id: binId('bin-2'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          x: gridUnits(2),
          y: gridUnits(0),
        }), // Adjacent, blocks expansion
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 5, depth: 3, height: 4 }), // Too wide
      ];
      const { mockShowSyncDialog } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockShowSyncDialog).toHaveBeenCalledWith(
        ['bin-1'],
        'design-1',
        'Test Design',
        expect.any(Object),
        expect.any(Array),
        false
      );
    });

    it('reconciles multiple design IDs independently', () => {
      const bins = [
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          linkedDesignId: designId('design-1'),
        }),
        makeBin({
          id: binId('bin-2'),
          width: gridUnits(1),
          depth: gridUnits(1),
          height: heightUnits(2),
          x: gridUnits(5),
          y: gridUnits(5),
          linkedDesignId: designId('design-2'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 3, depth: 3, height: 4 }),
        makeRegistryEntry({ id: designId('design-2'), width: 2, depth: 2, height: 3 }),
      ];
      const { mockUpdateBin } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).toHaveBeenCalledWith(
        'bin-1',
        expect.objectContaining({ width: 3, depth: 3, height: 4 })
      );
      expect(mockUpdateBin).toHaveBeenCalledWith(
        'bin-2',
        expect.objectContaining({ width: 2, depth: 2, height: 3 })
      );
    });
  });

  describe('real-time event handling', () => {
    it('auto-syncs bins when design-saved event is emitted', () => {
      const bins = [
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          linkedDesignId: designId('design-1'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 2, depth: 3, height: 4 }),
      ];
      const { mockUpdateBin } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      // Mount reconciliation should be a no-op (dimensions match)
      expect(mockUpdateBin).not.toHaveBeenCalled();

      // Now emit an event with changed dimensions
      emitSyncEvent({
        type: 'design-saved',
        designId: designId('design-1'),
        dimensions: { width: 3, depth: 4, height: 5 },
      });

      expect(mockUpdateBin).toHaveBeenCalledWith(
        'bin-1',
        expect.objectContaining({ width: 3, depth: 4, height: 5 })
      );
    });

    it('unsubscribes on unmount', () => {
      const bins = [
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          height: heightUnits(4),
          linkedDesignId: designId('design-1'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 2, depth: 3, height: 4 }),
      ];
      const { mockUpdateBin } = setupStores(bins, registry);

      const { unmount } = renderHook(() => useDesignSavedListener());
      unmount();

      emitSyncEvent({
        type: 'design-saved',
        designId: designId('design-1'),
        dimensions: { width: 5, depth: 5, height: 5 },
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });
  });

  describe('rotation and declines (#3040)', () => {
    it('leaves a bin alone when the design is its transpose', () => {
      // The reporter's case: an 11.5x1.5 design against a 1.5x11.5 bin. The
      // preview draws it rotated, so nothing needs syncing.
      const bins = [
        makeBin({
          id: binId('bin-1'),
          width: gridUnits(1.5),
          depth: gridUnits(11.5),
          height: heightUnits(7),
          linkedDesignId: designId('design-1'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 11.5, depth: 1.5, height: 7 }),
      ];
      const { mockUpdateBin, mockShowSyncDialog } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });

    it('never offers a rotation-fitting bin for sync alongside a mismatched one', () => {
      // Syncing rewrites a bin to the design's axis order, so including a bin
      // that already fits rotated could resize it out of the drawer and unlink
      // it. Only genuinely mismatched bins may reach the prompt.
      const bins = [
        makeBin({
          id: binId('rotated-fits'),
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(1.5),
          depth: gridUnits(9),
          height: heightUnits(7),
          linkedDesignId: designId('design-1'),
        }),
        makeBin({
          id: binId('needs-sync'),
          x: gridUnits(4),
          y: gridUnits(4),
          width: gridUnits(2),
          depth: gridUnits(2),
          height: heightUnits(7),
          linkedDesignId: designId('design-1'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 9, depth: 1.5, height: 7 }),
      ];
      const { mockShowSyncDialog } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockShowSyncDialog).toHaveBeenCalledTimes(1);
      const [binIds, , , , eligibility] = mockShowSyncDialog.mock.calls[0];
      expect(binIds).toEqual([binId('needs-sync')]);
      expect(eligibility).toHaveLength(1);
    });

    it('skips the prompt for a design + dimensions already declined', () => {
      const bins = [
        makeBin({
          id: binId('bin-1'),
          x: gridUnits(8),
          y: gridUnits(8),
          width: gridUnits(2),
          depth: gridUnits(2),
          height: heightUnits(4),
          linkedDesignId: designId('design-1'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 5, depth: 5, height: 4 }),
      ];
      const { mockShowSyncDialog } = setupStores(bins, registry);
      useLinkingStore.setState({ declinedSyncs: { 'design-1': '5x5x4' } });

      renderHook(() => useDesignSavedListener());

      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });

    it('still prompts when the design moved on from the declined dimensions', () => {
      const bins = [
        makeBin({
          id: binId('bin-1'),
          x: gridUnits(8),
          y: gridUnits(8),
          width: gridUnits(2),
          depth: gridUnits(2),
          height: heightUnits(4),
          linkedDesignId: designId('design-1'),
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: designId('design-1'), width: 5, depth: 5, height: 4 }),
      ];
      const { mockShowSyncDialog } = setupStores(bins, registry);
      useLinkingStore.setState({ declinedSyncs: { 'design-1': '6x6x4' } });

      renderHook(() => useDesignSavedListener());

      expect(mockShowSyncDialog).toHaveBeenCalledTimes(1);
    });
  });

  // Made 1x3, `ahead` would stand its support on the cell `behind` covers
  // until `behind` has narrowed too; the layout lists `ahead` first.
  describe('applying the sync', () => {
    const DESIGN = designId('design-1');
    const linked = (id: string, x: number, y: number) =>
      createTestBin({
        id: binId(id),
        x: gridUnits(x),
        y: gridUnits(y),
        width: gridUnits(2),
        height: heightUnits(6),
        linkedDesignId: DESIGN,
      });
    const addToast = vi.fn();
    const saved = (): void =>
      emitSyncEvent({
        type: 'design-saved',
        designId: DESIGN,
        dimensions: { width: 1, depth: 3, height: 6 },
      });

    beforeEach(() => {
      registerLinkedSlantResolver(() => ({
        config: { angleDeg: 45, side: 'back', endSupport: true },
        width: 1,
        depth: 3,
        height: 6,
      }));
      vi.mocked(UseCustomBins.useCustomBins).mockReturnValue([]);
      useToastStore.setState({ addToast, toasts: [] });
      useLayoutStore.setState({
        layout: createTestLayout({
          drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
          bins: [linked('ahead', 1, 0), linked('behind', 0, 3)],
        }),
      });
    });

    afterEach(() => registerLinkedSlantResolver(null));

    it('resizes every linked bin, in an order where none waits on another', () => {
      vi.mocked(MutationsContext.useMutations).mockReturnValue(createCqrsMutations(commandBus));
      renderHook(() => useDesignSavedListener());

      saved();

      const bins = useLayoutStore.getState().layout.bins;
      for (const bin of bins) expect(bin).toMatchObject({ width: 1, depth: 3 });
      expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('says how many kept their size instead of reporting success', () => {
      const updateBin = vi.fn((id: string) =>
        id === 'ahead'
          ? err({ code: 'VALIDATION_COLLISION', message: 'taken' } as never)
          : ok(undefined)
      );
      vi.mocked(MutationsContext.useMutations).mockReturnValue({ updateBin } as never);
      renderHook(() => useDesignSavedListener());

      saved();

      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          message: expect.stringContaining('1 kept their old size'),
        })
      );
    });
  });
});
