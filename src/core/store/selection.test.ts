import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from '@/core/store/selection';
import { resetAllStores } from '@/test/testUtils';
import { binId, layerId, categoryId } from '@/core/types';

describe('selection store', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('initial state', () => {
    it('starts with empty selection', () => {
      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
    });

    it('starts with null focused bin', () => {
      const { focusedBinId } = useSelectionStore.getState();
      expect(focusedBinId).toBeNull();
    });

    it('starts with null quick label bin', () => {
      const { quickLabelBinId } = useSelectionStore.getState();
      expect(quickLabelBinId).toBeNull();
    });
  });

  describe('setSelectedBin', () => {
    it('selects a single bin', () => {
      const { setSelectedBin } = useSelectionStore.getState();
      const id = binId('bin-1');

      setSelectedBin(id);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([id]);
    });

    it('replaces existing selection with new bin', () => {
      const { setSelectedBin } = useSelectionStore.getState();
      const id1 = binId('bin-1');
      const id2 = binId('bin-2');

      setSelectedBin(id1);
      setSelectedBin(id2);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([id2]);
    });

    it('clears selection when passed null', () => {
      const { setSelectedBin, setSelectedBins } = useSelectionStore.getState();
      setSelectedBins([binId('bin-1'), binId('bin-2')]);

      setSelectedBin(null);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
    });
  });

  describe('setSelectedBins', () => {
    it('sets multiple bins at once', () => {
      const { setSelectedBins } = useSelectionStore.getState();
      const ids = [binId('bin-1'), binId('bin-2'), binId('bin-3')];

      setSelectedBins(ids);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual(ids);
    });

    it('replaces existing selection entirely', () => {
      const { setSelectedBins } = useSelectionStore.getState();

      setSelectedBins([binId('bin-1')]);
      setSelectedBins([binId('bin-2'), binId('bin-3')]);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([binId('bin-2'), binId('bin-3')]);
    });

    it('accepts empty array to clear selection', () => {
      const { setSelectedBins } = useSelectionStore.getState();
      setSelectedBins([binId('bin-1')]);

      setSelectedBins([]);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
    });
  });

  describe('addToSelection', () => {
    it('adds bin to empty selection', () => {
      const { addToSelection } = useSelectionStore.getState();
      const id = binId('bin-1');

      addToSelection(id);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([id]);
    });

    it('adds bin to existing selection', () => {
      const { setSelectedBin, addToSelection } = useSelectionStore.getState();
      const id1 = binId('bin-1');
      const id2 = binId('bin-2');

      setSelectedBin(id1);
      addToSelection(id2);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([id1, id2]);
    });

    it('does not duplicate already selected bins', () => {
      const { addToSelection } = useSelectionStore.getState();
      const id = binId('bin-1');

      addToSelection(id);
      addToSelection(id);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([id]);
    });
  });

  describe('removeFromSelection', () => {
    it('removes bin from selection', () => {
      const { setSelectedBins, removeFromSelection } = useSelectionStore.getState();
      const id1 = binId('bin-1');
      const id2 = binId('bin-2');

      setSelectedBins([id1, id2]);
      removeFromSelection(id1);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([id2]);
    });

    it('does nothing if bin not in selection', () => {
      const { setSelectedBin, removeFromSelection } = useSelectionStore.getState();
      const id1 = binId('bin-1');
      const id2 = binId('bin-2');

      setSelectedBin(id1);
      removeFromSelection(id2);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([id1]);
    });

    it('handles removing from empty selection', () => {
      const { removeFromSelection } = useSelectionStore.getState();

      removeFromSelection(binId('bin-1'));

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
    });
  });

  describe('toggleSelection', () => {
    it('adds unselected bin to selection', () => {
      const { toggleSelection } = useSelectionStore.getState();
      const id = binId('bin-1');

      toggleSelection(id);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([id]);
    });

    it('removes already selected bin from selection', () => {
      const { setSelectedBin, toggleSelection } = useSelectionStore.getState();
      const id = binId('bin-1');

      setSelectedBin(id);
      toggleSelection(id);

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
    });

    it('toggles correctly in multi-selection', () => {
      const { setSelectedBins, toggleSelection } = useSelectionStore.getState();
      const id1 = binId('bin-1');
      const id2 = binId('bin-2');
      const id3 = binId('bin-3');

      setSelectedBins([id1, id2]);

      // Toggle existing bin off
      toggleSelection(id1);
      expect(useSelectionStore.getState().selectedBinIds).toEqual([id2]);

      // Toggle new bin on
      toggleSelection(id3);
      expect(useSelectionStore.getState().selectedBinIds).toEqual([id2, id3]);
    });
  });

  describe('clearSelection', () => {
    it('clears all selected bins', () => {
      const { setSelectedBins, clearSelection } = useSelectionStore.getState();

      setSelectedBins([binId('bin-1'), binId('bin-2'), binId('bin-3')]);
      clearSelection();

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
    });

    it('is idempotent on empty selection', () => {
      const { clearSelection } = useSelectionStore.getState();

      clearSelection();

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
    });
  });

  describe('setActiveLayer', () => {
    it('sets the active layer', () => {
      const { setActiveLayer } = useSelectionStore.getState();
      const id = layerId('layer-2');

      setActiveLayer(id);

      const { activeLayerId } = useSelectionStore.getState();
      expect(activeLayerId).toBe(id);
    });

    it('clears selection when layer changes (PRD behavior)', () => {
      const { setSelectedBins, setActiveLayer } = useSelectionStore.getState();

      setSelectedBins([binId('bin-1'), binId('bin-2')]);
      setActiveLayer(layerId('layer-2'));

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
    });
  });

  describe('setActiveCategory', () => {
    it('sets the active category', () => {
      const { setActiveCategory } = useSelectionStore.getState();
      const id = categoryId('tools');

      setActiveCategory(id);

      const { activeCategoryId } = useSelectionStore.getState();
      expect(activeCategoryId).toBe(id);
    });

    it('does not clear selection when category changes', () => {
      const { setSelectedBins, setActiveCategory } = useSelectionStore.getState();

      setSelectedBins([binId('bin-1')]);
      setActiveCategory(categoryId('tools'));

      const { selectedBinIds } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([binId('bin-1')]);
    });
  });

  describe('setFocusedBin', () => {
    it('sets focused bin for keyboard navigation', () => {
      const { setFocusedBin } = useSelectionStore.getState();
      const id = binId('bin-1');

      setFocusedBin(id);

      const { focusedBinId } = useSelectionStore.getState();
      expect(focusedBinId).toBe(id);
    });

    it('clears focused bin when passed null', () => {
      const { setFocusedBin } = useSelectionStore.getState();

      setFocusedBin(binId('bin-1'));
      setFocusedBin(null);

      const { focusedBinId } = useSelectionStore.getState();
      expect(focusedBinId).toBeNull();
    });

    it('focus is independent of selection', () => {
      const { setSelectedBin, setFocusedBin, clearSelection } = useSelectionStore.getState();
      const id = binId('bin-1');

      setSelectedBin(id);
      setFocusedBin(id);
      clearSelection();

      const { selectedBinIds, focusedBinId } = useSelectionStore.getState();
      expect(selectedBinIds).toEqual([]);
      expect(focusedBinId).toBe(id);
    });
  });

  describe('showQuickLabel / hideQuickLabel', () => {
    it('shows quick label popover for bin', () => {
      const { showQuickLabel } = useSelectionStore.getState();
      const id = binId('bin-1');

      showQuickLabel(id);

      const { quickLabelBinId } = useSelectionStore.getState();
      expect(quickLabelBinId).toBe(id);
    });

    it('hides quick label popover', () => {
      const { showQuickLabel, hideQuickLabel } = useSelectionStore.getState();

      showQuickLabel(binId('bin-1'));
      hideQuickLabel();

      const { quickLabelBinId } = useSelectionStore.getState();
      expect(quickLabelBinId).toBeNull();
    });

    it('replaces existing quick label when showing new one', () => {
      const { showQuickLabel } = useSelectionStore.getState();
      const id1 = binId('bin-1');
      const id2 = binId('bin-2');

      showQuickLabel(id1);
      showQuickLabel(id2);

      const { quickLabelBinId } = useSelectionStore.getState();
      expect(quickLabelBinId).toBe(id2);
    });
  });
});
