import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiBinInspector } from '../../components/Inspector';
import type { UseBinInspectorReturn } from '../../components/Inspector';
import { resetAllStores } from '../testUtils';

describe('MultiBinInspector', () => {
  const mockBins = [
    {
      id: 'bin1',
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 4,
      layerId: 'layer1',
      category: 'coral',
      label: '',
      notes: '',
      clearanceHeight: 0,
    },
    {
      id: 'bin2',
      x: 2,
      y: 0,
      width: 3,
      depth: 2,
      height: 5,
      layerId: 'layer1',
      category: 'coral',
      label: '',
      notes: '',
      clearanceHeight: 0,
    },
  ];

  const mockLayout = {
    drawer: { width: 10, depth: 8, height: 12 },
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
    categories: [
      { id: 'coral', name: 'Coral', color: '#FF6B6B' },
      { id: 'sky', name: 'Sky', color: '#38bdf8' },
    ],
    layers: [
      { id: 'layer1', name: 'Layer 1', height: 3 },
      { id: 'layer2', name: 'Layer 2', height: 6 },
    ],
  };

  const createMockInspector = (overrides?: Partial<UseBinInspectorReturn>): UseBinInspectorReturn => ({
    bin: null,
    selectedBins: mockBins,
    category: null,
    layer: null,
    layout: mockLayout as UseBinInspectorReturn['layout'],
    categories: mockLayout.categories,
    constraints: {
      minHeight: 3,
      maxHeight: 12,
      maxClearance: 5,
      maxGridUnits: 6,
      heightRange: '3-12u',
    },
    updateField: vi.fn(),
    updateMultiCategory: vi.fn(),
    updateMultiHeight: vi.fn(),
    updateMultiClearance: vi.fn(),
    updateMultiLayer: vi.fn(),
    moveToLayer: vi.fn(),
    requestDelete: vi.fn(),
    moveToStaging: vi.fn(),
    clearSelection: vi.fn(),
    rotateBin: vi.fn(),
    confirmDelete: null,
    setConfirmDelete: vi.fn(),
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
      expect(screen.getByText('Bins Selected')).toBeInTheDocument();
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
        { ...mockBins[0], category: 'coral' },
        { ...mockBins[1], category: 'sky' },
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
        } as UseBinInspectorReturn['layout'],
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
        { ...mockBins[0], layerId: 'layer1' },
        { ...mockBins[1], layerId: 'layer2' },
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
        { ...mockBins[0], height: 4 },
        { ...mockBins[1], height: 4 },
      ];
      const inspector = createMockInspector({ selectedBins: sameBins });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('4u')).toBeInTheDocument();
    });

    it('shows height range when heights differ', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      // Heights are 4 and 5
      expect(screen.getByText('4–5u')).toBeInTheDocument();
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
  });

  describe('clearance handling', () => {
    it('hides clearance control when no bins have clearance', () => {
      const inspector = createMockInspector();
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByText('Clearance')).not.toBeInTheDocument();
    });

    it('shows clearance control when any bin has clearance', () => {
      const binsWithClearance = [
        { ...mockBins[0], clearanceHeight: 2 },
        { ...mockBins[1], clearanceHeight: 0 },
      ];
      const inspector = createMockInspector({ selectedBins: binsWithClearance });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('Clearance')).toBeInTheDocument();
    });

    it('shows clearance range when clearances differ', () => {
      const binsWithClearance = [
        { ...mockBins[0], clearanceHeight: 1 },
        { ...mockBins[1], clearanceHeight: 3 },
      ];
      const inspector = createMockInspector({ selectedBins: binsWithClearance });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('1–3u')).toBeInTheDocument();
    });

    it('calls updateMultiClearance when clearance buttons clicked', () => {
      const binsWithClearance = [
        { ...mockBins[0], clearanceHeight: 2 },
        { ...mockBins[1], clearanceHeight: 2 },
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
      const stagingBins = mockBins.map((b) => ({ ...b, layerId: '__staging__' }));
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

  describe('many bins selected', () => {
    it('handles large selection', () => {
      const manyBins = Array(20).fill(null).map((_, i) => ({
        ...mockBins[0],
        id: `bin${i}`,
        category: i % 2 === 0 ? 'coral' : 'sky',
      }));
      const inspector = createMockInspector({ selectedBins: manyBins });
      render(<MultiBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });
});
