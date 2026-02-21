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
import type { CustomBinRef } from '@/features/bin-designer/store/customBinRegistry';

vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: vi.fn(),
}));

vi.mock('@/features/bin-designer/hooks/useCustomBins', () => ({
  useCustomBins: vi.fn(),
}));

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

function makeRegistryEntry(overrides: Partial<CustomBinRef> = {}): CustomBinRef {
  return {
    id: 'design-1',
    name: 'Test Design',
    width: 2,
    depth: 3,
    height: 4,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function setupStores(bins: Bin[], registryEntries: CustomBinRef[] = []) {
  const mockUpdateBin = vi.fn();
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
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, linkedDesignId: 'design-1' }),
      ];
      const registry = [makeRegistryEntry({ id: 'design-1', width: 3, depth: 3, height: 5 })];
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
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, linkedDesignId: 'design-1' }),
      ];
      const registry = [makeRegistryEntry({ id: 'design-1', width: 2, depth: 3, height: 4 })];
      const { mockUpdateBin, mockShowSyncDialog } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });

    it('does nothing when there are no linked bins', () => {
      const bins = [makeBin({ id: 'bin-1' })]; // No linkedDesignId
      const registry = [makeRegistryEntry({ id: 'design-1', width: 5, depth: 5, height: 5 })];
      const { mockUpdateBin, mockShowSyncDialog } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });

    it('does nothing when linked design is not in registry', () => {
      const bins = [makeBin({ id: 'bin-1', linkedDesignId: 'design-missing' })];
      const { mockUpdateBin, mockShowSyncDialog } = setupStores(bins, []);

      renderHook(() => useDesignSavedListener());

      expect(mockUpdateBin).not.toHaveBeenCalled();
      expect(mockShowSyncDialog).not.toHaveBeenCalled();
    });

    it('shows sync dialog when bins cannot fit new dimensions', () => {
      const bins = [
        makeBin({
          id: 'bin-1',
          width: 2,
          depth: 3,
          height: 4,
          x: 0,
          y: 0,
          linkedDesignId: 'design-1',
        }),
        makeBin({ id: 'bin-2', width: 2, depth: 3, height: 4, x: 2, y: 0 }), // Adjacent, blocks expansion
      ];
      const registry = [
        makeRegistryEntry({ id: 'design-1', width: 5, depth: 3, height: 4 }), // Too wide
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
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, linkedDesignId: 'design-1' }),
        makeBin({
          id: 'bin-2',
          width: 1,
          depth: 1,
          height: 2,
          x: 5,
          y: 5,
          linkedDesignId: 'design-2',
        }),
      ];
      const registry = [
        makeRegistryEntry({ id: 'design-1', width: 3, depth: 3, height: 4 }),
        makeRegistryEntry({ id: 'design-2', width: 2, depth: 2, height: 3 }),
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
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, linkedDesignId: 'design-1' }),
      ];
      const registry = [makeRegistryEntry({ id: 'design-1', width: 2, depth: 3, height: 4 })];
      const { mockUpdateBin } = setupStores(bins, registry);

      renderHook(() => useDesignSavedListener());

      // Mount reconciliation should be a no-op (dimensions match)
      expect(mockUpdateBin).not.toHaveBeenCalled();

      // Now emit an event with changed dimensions
      emitSyncEvent({
        type: 'design-saved',
        designId: 'design-1',
        dimensions: { width: 3, depth: 4, height: 5 },
      });

      expect(mockUpdateBin).toHaveBeenCalledWith(
        'bin-1',
        expect.objectContaining({ width: 3, depth: 4, height: 5 })
      );
    });

    it('unsubscribes on unmount', () => {
      const bins = [
        makeBin({ id: 'bin-1', width: 2, depth: 3, height: 4, linkedDesignId: 'design-1' }),
      ];
      const registry = [makeRegistryEntry({ id: 'design-1', width: 2, depth: 3, height: 4 })];
      const { mockUpdateBin } = setupStores(bins, registry);

      const { unmount } = renderHook(() => useDesignSavedListener());
      unmount();

      emitSyncEvent({
        type: 'design-saved',
        designId: 'design-1',
        dimensions: { width: 5, depth: 5, height: 5 },
      });

      expect(mockUpdateBin).not.toHaveBeenCalled();
    });
  });
});
