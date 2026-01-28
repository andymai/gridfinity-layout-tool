import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLinkingStore } from '../../store/linkingStore';
import type { DimensionComparison, SyncEligibility, SyncableDimensions } from '../../types';

describe('linkingStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useLinkingStore.setState({
      pendingSync: null,
      pendingDeleteWarning: null,
      pendingCreateDesign: null,
    });
  });

  describe('initial state', () => {
    it('has null dialog states initially', () => {
      const state = useLinkingStore.getState();
      expect(state.pendingSync).toBeNull();
      expect(state.pendingDeleteWarning).toBeNull();
      expect(state.pendingCreateDesign).toBeNull();
    });
  });

  describe('sync dialog', () => {
    it('showSyncDialog sets pendingSync state', () => {
      const comparison: DimensionComparison = {
        matched: false,
        design: { width: 3, depth: 3, height: 4 },
        bin: { width: 2, depth: 2, height: 4 },
        differences: { width: true, depth: true, height: false },
      };
      const eligibility: SyncEligibility[] = [{ binId: 'bin-1', canSync: true }];

      useLinkingStore.getState().showSyncDialog(
        ['bin-1'],
        'design-1',
        'Test Design',
        comparison,
        eligibility
      );

      const state = useLinkingStore.getState();
      expect(state.pendingSync).not.toBeNull();
      expect(state.pendingSync?.binIds).toEqual(['bin-1']);
      expect(state.pendingSync?.designId).toBe('design-1');
      expect(state.pendingSync?.designName).toBe('Test Design');
      expect(state.pendingSync?.comparison).toEqual(comparison);
      expect(state.pendingSync?.eligibility).toEqual(eligibility);
    });

    it('showSyncDialog supports multiple bin IDs', () => {
      const comparison: DimensionComparison = {
        matched: false,
        design: { width: 3, depth: 3, height: 4 },
        bin: { width: 2, depth: 2, height: 4 },
        differences: { width: true, depth: true, height: false },
      };
      const eligibility: SyncEligibility[] = [
        { binId: 'bin-1', canSync: true },
        { binId: 'bin-2', canSync: false, blockReason: 'collision' },
      ];

      useLinkingStore.getState().showSyncDialog(
        ['bin-1', 'bin-2'],
        'design-1',
        'Test Design',
        comparison,
        eligibility
      );

      expect(useLinkingStore.getState().pendingSync?.binIds).toEqual(['bin-1', 'bin-2']);
    });

    it('hideSyncDialog clears pendingSync state', () => {
      // First show the dialog
      const comparison: DimensionComparison = {
        matched: false,
        design: { width: 3, depth: 3, height: 4 },
        bin: { width: 2, depth: 2, height: 4 },
        differences: { width: true, depth: true, height: false },
      };

      useLinkingStore.getState().showSyncDialog(
        ['bin-1'],
        'design-1',
        'Test Design',
        comparison,
        []
      );

      expect(useLinkingStore.getState().pendingSync).not.toBeNull();

      // Now hide it
      useLinkingStore.getState().hideSyncDialog();
      expect(useLinkingStore.getState().pendingSync).toBeNull();
    });
  });

  describe('delete warning dialog', () => {
    it('showDeleteWarning sets pendingDeleteWarning state', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      useLinkingStore.getState().showDeleteWarning(
        'design-1',
        'My Design',
        ['bin-1', 'bin-2'],
        onConfirm,
        onCancel
      );

      const state = useLinkingStore.getState();
      expect(state.pendingDeleteWarning).not.toBeNull();
      expect(state.pendingDeleteWarning?.designId).toBe('design-1');
      expect(state.pendingDeleteWarning?.designName).toBe('My Design');
      expect(state.pendingDeleteWarning?.linkedBinIds).toEqual(['bin-1', 'bin-2']);
      expect(state.pendingDeleteWarning?.onConfirm).toBe(onConfirm);
      expect(state.pendingDeleteWarning?.onCancel).toBe(onCancel);
    });

    it('hideDeleteWarning clears pendingDeleteWarning state', () => {
      // First show the dialog
      useLinkingStore.getState().showDeleteWarning(
        'design-1',
        'My Design',
        ['bin-1'],
        vi.fn(),
        vi.fn()
      );

      expect(useLinkingStore.getState().pendingDeleteWarning).not.toBeNull();

      // Now hide it
      useLinkingStore.getState().hideDeleteWarning();
      expect(useLinkingStore.getState().pendingDeleteWarning).toBeNull();
    });

    it('stores callbacks that can be called later', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      useLinkingStore.getState().showDeleteWarning(
        'design-1',
        'My Design',
        ['bin-1'],
        onConfirm,
        onCancel
      );

      const warning = useLinkingStore.getState().pendingDeleteWarning;
      expect(warning).not.toBeNull();

      // Simulate user clicking confirm
      warning?.onConfirm();
      expect(onConfirm).toHaveBeenCalled();

      // Simulate user clicking cancel
      warning?.onCancel();
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('create design dialog', () => {
    it('showCreateDesignDialog sets pendingCreateDesign state', () => {
      const dimensions: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      useLinkingStore.getState().showCreateDesignDialog(
        'bin-1',
        '2×3×4 Bin',
        dimensions,
        'My Label'
      );

      const state = useLinkingStore.getState();
      expect(state.pendingCreateDesign).not.toBeNull();
      expect(state.pendingCreateDesign?.binId).toBe('bin-1');
      expect(state.pendingCreateDesign?.defaultName).toBe('2×3×4 Bin');
      expect(state.pendingCreateDesign?.dimensions).toEqual(dimensions);
      expect(state.pendingCreateDesign?.binLabel).toBe('My Label');
    });

    it('showCreateDesignDialog works without binLabel', () => {
      const dimensions: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      useLinkingStore.getState().showCreateDesignDialog('bin-1', '2×3×4 Bin', dimensions);

      const state = useLinkingStore.getState();
      expect(state.pendingCreateDesign?.binLabel).toBeUndefined();
    });

    it('hideCreateDesignDialog clears pendingCreateDesign state', () => {
      const dimensions: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      useLinkingStore.getState().showCreateDesignDialog('bin-1', '2×3×4 Bin', dimensions);
      expect(useLinkingStore.getState().pendingCreateDesign).not.toBeNull();

      useLinkingStore.getState().hideCreateDesignDialog();
      expect(useLinkingStore.getState().pendingCreateDesign).toBeNull();
    });
  });

  describe('multiple dialogs', () => {
    it('can have multiple dialog states set independently', () => {
      const dimensions: SyncableDimensions = { width: 2, depth: 3, height: 4 };
      const comparison: DimensionComparison = {
        matched: false,
        design: dimensions,
        bin: { width: 1, depth: 1, height: 1 },
        differences: { width: true, depth: true, height: true },
      };

      // Show create design dialog
      useLinkingStore.getState().showCreateDesignDialog('bin-1', '2×3×4 Bin', dimensions);

      // Show delete warning dialog
      useLinkingStore.getState().showDeleteWarning(
        'design-1',
        'My Design',
        ['bin-2'],
        vi.fn(),
        vi.fn()
      );

      // Show sync dialog
      useLinkingStore.getState().showSyncDialog(
        ['bin-3'],
        'design-2',
        'Other Design',
        comparison,
        []
      );

      // All three should be set
      const state = useLinkingStore.getState();
      expect(state.pendingCreateDesign).not.toBeNull();
      expect(state.pendingDeleteWarning).not.toBeNull();
      expect(state.pendingSync).not.toBeNull();
    });

    it('hiding one dialog does not affect others', () => {
      const dimensions: SyncableDimensions = { width: 2, depth: 3, height: 4 };

      // Show two dialogs
      useLinkingStore.getState().showCreateDesignDialog('bin-1', '2×3×4 Bin', dimensions);
      useLinkingStore.getState().showDeleteWarning(
        'design-1',
        'My Design',
        ['bin-2'],
        vi.fn(),
        vi.fn()
      );

      // Hide only the create design dialog
      useLinkingStore.getState().hideCreateDesignDialog();

      // Create design should be null, delete warning should still exist
      const state = useLinkingStore.getState();
      expect(state.pendingCreateDesign).toBeNull();
      expect(state.pendingDeleteWarning).not.toBeNull();
    });
  });
});
