import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiBinInspector } from '@/features/bin-inspector';
import type { UseBinInspectorReturn } from '@/features/bin-inspector';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';

describe('MultiBinInspector', () => {
  const mockBins = [
    createTestBin({
      id: binId('bin1'),
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
      height: heightUnits(4),
      layerId: layerId('layer1'),
      category: categoryId('coral'),
      label: '',
      notes: '',
      clearanceHeight: heightUnits(0),
    }),
    createTestBin({
      id: binId('bin2'),
      x: gridUnits(2),
      y: gridUnits(0),
      width: gridUnits(3),
      depth: gridUnits(2),
      height: heightUnits(5),
      layerId: layerId('layer1'),
      category: categoryId('coral'),
      label: '',
      notes: '',
      clearanceHeight: heightUnits(0),
    }),
  ];

  const mockLayout = createTestLayout({
    categories: [
      { id: categoryId('coral'), name: 'Coral', color: '#FF6B6B' },
      { id: categoryId('sky'), name: 'Sky', color: '#38bdf8' },
    ],
    layers: [
      { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
      { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(6) },
    ],
  });

  const createMockInspector = (
    overrides?: Partial<UseBinInspectorReturn>
  ): UseBinInspectorReturn => ({
    bin: null,
    selectedBins: mockBins,
    isMultiSelect: true,
    category: null,
    layer: null,
    layout: mockLayout,
    categories: mockLayout.categories,
    constraints: {
      minHeight: 3,
      maxHeight: 12,
      maxClearance: 5,
      maxGridUnits: { width: 6, depth: 6 },
      needsSplit: false,
      heightRange: '3-12u',
      minHeightReason: 'layer_height',
      maxHeightReason: 'remaining_space',
    },
    updateField: vi.fn(),
    updateCustomProperties: vi.fn(),
    updateMultiCustomProperty: vi.fn(),
    updateMultiCategory: vi.fn(),
    updateMultiHeight: vi.fn(),
    updateMultiClearance: vi.fn(),
    updateMultiLayer: vi.fn(),
    moveToLayer: vi.fn(),
    requestDelete: vi.fn(),
    moveToStaging: vi.fn(),
    clearSelection: vi.fn(),
    rotateBin: vi.fn(),
    applySuggestedSize: vi.fn(),
    canApplySuggestedSize: vi.fn(),
    toggleLock: vi.fn(),
    setMultiLock: vi.fn(),
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn(),
    deleteConfirmState: null,
    existingPropertyKeys: [],
    ...overrides,
  });

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('shows bin count in header', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('bins selected')).toBeInTheDocument();
    });

    it('shows help text', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText(/Drag to move together/)).toBeInTheDocument();
    });

    it('returns null when no bins selected', () => {
      const inspector = createMockInspector({ selectedBins: [] });
      const { container } = render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('category handling', () => {
    it('shows category dropdown with common category selected', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Category for selected bins')).toHaveValue('coral');
    });

    it('shows mixed label when categories differ', () => {
      const mixedBins = [
        { ...mockBins[0], category: categoryId('coral') },
        { ...mockBins[1], category: categoryId('sky') },
      ];
      const inspector = createMockInspector({ selectedBins: mixedBins });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      // Should show mixed label with counts
      expect(screen.getByText(/1 Coral/)).toBeInTheDocument();
    });

    it('calls updateMultiCategory when category changes', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.change(screen.getByLabelText('Category for selected bins'), {
        target: { value: 'sky' },
      });

      expect(inspector.updateMultiCategory).toHaveBeenCalledWith('sky');
    });
  });

  describe('layer handling', () => {
    it('shows layer dropdown when multiple layers and grid bins exist', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Layer for selected bins')).toBeInTheDocument();
    });

    it('hides layer dropdown with single layer', () => {
      const inspector = createMockInspector({
        layout: {
          ...mockLayout,
          layers: [mockLayout.layers[0]],
        },
      });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByLabelText('Layer for selected bins')).not.toBeInTheDocument();
    });

    it('shows common layer when all bins on same layer', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Layer for selected bins')).toHaveValue('layer1');
    });

    it('shows mixed label when layers differ', () => {
      const mixedLayerBins = [
        { ...mockBins[0], layerId: layerId('layer1') },
        { ...mockBins[1], layerId: layerId('layer2') },
      ];
      const inspector = createMockInspector({ selectedBins: mixedLayerBins });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText(/1 on Layer 1/)).toBeInTheDocument();
    });

    it('calls updateMultiLayer when layer changes', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.change(screen.getByLabelText('Layer for selected bins'), {
        target: { value: 'layer2' },
      });

      expect(inspector.updateMultiLayer).toHaveBeenCalledWith('layer2');
    });
  });

  describe('height handling', () => {
    it('shows single height when all bins same height', () => {
      const sameBins = [
        { ...mockBins[0], height: heightUnits(4) },
        { ...mockBins[1], height: heightUnits(4) },
      ];
      const inspector = createMockInspector({ selectedBins: sameBins });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      // 4u * 7mm = 28mm
      expect(screen.getByText('4u (28mm)')).toBeInTheDocument();
    });

    it('shows height range when heights differ', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      // Heights are 4 and 5 → 28mm and 35mm
      expect(screen.getByText('4–5u (28–35mm)')).toBeInTheDocument();
    });

    it('calls updateMultiHeight with +1 when increase clicked', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByLabelText('Increase height for all bins'));

      expect(inspector.updateMultiHeight).toHaveBeenCalledWith(1);
    });

    it('calls updateMultiHeight with -1 when decrease clicked', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByLabelText('Decrease height for all bins'));

      expect(inspector.updateMultiHeight).toHaveBeenCalledWith(-1);
    });

    it('disables both height buttons when every selected bin is locked', () => {
      const inspector = createMockInspector({
        selectedBins: mockBins.map((b) => ({ ...b, locked: true })),
      });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Increase height for all bins')).toBeDisabled();
      expect(screen.getByLabelText('Decrease height for all bins')).toBeDisabled();
    });

    it('leaves height buttons enabled when only some selected bins are locked', () => {
      const [first, ...rest] = mockBins;
      const inspector = createMockInspector({
        selectedBins: [{ ...first, locked: true }, ...rest],
      });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Increase height for all bins')).toBeEnabled();
      expect(screen.getByLabelText('Decrease height for all bins')).toBeEnabled();
    });
  });

  describe('clearance handling', () => {
    it('hides clearance control when no bins have clearance', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByText('Clearance')).not.toBeInTheDocument();
    });

    it('shows clearance control when any bin has clearance', () => {
      const binsWithClearance = [
        { ...mockBins[0], clearanceHeight: heightUnits(2) },
        { ...mockBins[1], clearanceHeight: heightUnits(0) },
      ];
      const inspector = createMockInspector({ selectedBins: binsWithClearance });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('Clearance')).toBeInTheDocument();
    });

    it('shows clearance range when clearances differ', () => {
      const binsWithClearance = [
        { ...mockBins[0], clearanceHeight: heightUnits(1) },
        { ...mockBins[1], clearanceHeight: heightUnits(3) },
      ];
      const inspector = createMockInspector({ selectedBins: binsWithClearance });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('1–3u')).toBeInTheDocument();
    });

    it('calls updateMultiClearance when clearance buttons clicked', () => {
      const binsWithClearance = [
        { ...mockBins[0], clearanceHeight: heightUnits(2) },
        { ...mockBins[1], clearanceHeight: heightUnits(2) },
      ];
      const inspector = createMockInspector({ selectedBins: binsWithClearance });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByLabelText('Increase clearance for all bins'));
      expect(inspector.updateMultiClearance).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByLabelText('Decrease clearance for all bins'));
      expect(inspector.updateMultiClearance).toHaveBeenCalledWith(-1);
    });
  });

  describe('actions', () => {
    it('shows To Stash button when some bins are on grid', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('To Stash')).toBeInTheDocument();
    });

    it('hides To Stash button when all bins in staging', () => {
      const stagingBins = mockBins.map((b) => ({ ...b, layerId: STAGING_ID }));
      const inspector = createMockInspector({ selectedBins: stagingBins });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByText('To Stash')).not.toBeInTheDocument();
    });

    it('calls moveToStaging when stash button clicked', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByText('To Stash'));

      expect(inspector.moveToStaging).toHaveBeenCalled();
    });

    it('calls requestDelete when delete button clicked', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByText('Delete All'));

      expect(inspector.requestDelete).toHaveBeenCalled();
    });

    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" onClose={onClose} />);

      fireEvent.click(screen.getByLabelText('Deselect all bins'));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('mobile variant', () => {
    it('applies mobile-specific styles', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="mobile" />);

      expect(screen.getByText('Delete All').className).toContain('h-12');
    });
  });

  describe('size lock', () => {
    it('locks the whole selection when none are locked', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByText('Lock all sizes'));

      expect(inspector.setMultiLock).toHaveBeenCalledWith(true);
    });

    it('offers unlock once every bin is locked', () => {
      const inspector = createMockInspector({
        selectedBins: mockBins.map((b) => ({ ...b, locked: true })),
      });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByText('Unlock all sizes'));

      expect(inspector.setMultiLock).toHaveBeenCalledWith(false);
    });

    it('reports how much of a mixed selection is locked', () => {
      const [first, ...rest] = mockBins;
      const inspector = createMockInspector({
        selectedBins: [{ ...first, locked: true }, ...rest],
      });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(
        screen.getByText(`1 of ${mockBins.length} selected bins are size-locked`)
      ).toBeInTheDocument();
      // Still offers to lock the rest, not to unlock the one.
      expect(screen.getByText('Lock all sizes')).toBeInTheDocument();
    });
  });

  describe('many bins selected', () => {
    it('handles large selection', () => {
      const manyBins = Array(20)
        .fill(null)
        .map((_, i) => ({
          ...mockBins[0],
          id: binId(`bin${i}`),
          category: categoryId(i % 2 === 0 ? 'coral' : 'sky'),
        }));
      const inspector = createMockInspector({ selectedBins: manyBins });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });
});
