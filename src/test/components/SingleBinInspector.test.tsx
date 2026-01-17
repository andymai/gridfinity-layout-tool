import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SingleBinInspector } from '../../components/Inspector/SingleBinInspector';
import type { UseBinInspectorReturn } from '../../components/Inspector/useBinInspector';
import { resetAllStores } from '../testUtils';
import { useUIStore } from '../../core/store';

// Mock the DeferredNumberInput component to simplify testing
vi.mock('../../components/DeferredNumberInput', () => ({
  DeferredNumberInput: ({ value, onChange, ...props }: { value: number; onChange: (v: number) => void; [key: string]: unknown }) => (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      {...props}
    />
  ),
}));

describe('SingleBinInspector', () => {
  const mockBin = {
    id: 'bin1',
    x: 0,
    y: 0,
    width: 2,
    depth: 3,
    height: 4,
    layerId: 'layer1',
    category: 'coral',
    label: 'Test Label',
    notes: 'Test notes',
    clearanceHeight: 1,
  };

  const mockCategory = { id: 'coral', name: 'Coral', color: '#FF6B6B' };
  const mockLayer = { id: 'layer1', name: 'Layer 1', height: 3 };

  const mockLayout = {
    drawer: { width: 10, depth: 8, height: 12 },
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
    categories: [mockCategory, { id: 'sky', name: 'Sky', color: '#38bdf8' }],
    layers: [mockLayer, { id: 'layer2', name: 'Layer 2', height: 6 }],
  };

  const createMockInspector = (overrides?: Partial<UseBinInspectorReturn>): UseBinInspectorReturn => ({
    bin: mockBin,
    selectedBins: [mockBin],
    category: mockCategory,
    layer: mockLayer,
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
    it('renders bin dimensions in header', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('2×3 Bin')).toBeInTheDocument();
    });

    it('renders category color swatch', () => {
      const inspector = createMockInspector();
      const { container } = render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      const swatch = container.querySelector('[style*="background-color"]');
      expect(swatch).toBeInTheDocument();
    });

    it('renders width and depth inputs', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Bin width')).toHaveValue(2);
      expect(screen.getByLabelText('Bin depth')).toHaveValue(3);
    });

    it('renders real-world dimensions', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      // 2 * 42 = 84mm, 3 * 42 = 126mm, 4 * 7 = 28mm
      expect(screen.getByText(/84 × 126 × 28 mm/)).toBeInTheDocument();
    });

    it('renders height control with current value', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('4u')).toBeInTheDocument();
    });

    it('renders clearance control when maxClearance > 0', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('Clearance')).toBeInTheDocument();
      expect(screen.getByText('1u')).toBeInTheDocument();
    });

    it('hides clearance control when maxClearance is 0', () => {
      const inspector = createMockInspector({
        constraints: {
          minHeight: 3,
          maxHeight: 12,
          maxClearance: 0,
          maxGridUnits: 6,
          heightRange: '3-12u',
        },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByText('Clearance')).not.toBeInTheDocument();
    });

    it('renders label input with current value', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Bin label')).toHaveValue('Test Label');
    });

    it('renders notes textarea with current value', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Bin notes')).toHaveValue('Test notes');
    });

    it('renders category dropdown', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Bin category')).toHaveValue('coral');
    });

    it('renders layer dropdown when multiple layers exist', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Bin layer')).toHaveValue('layer1');
    });

    it('hides layer dropdown with single layer', () => {
      const inspector = createMockInspector({
        layout: {
          ...mockLayout,
          layers: [mockLayer],
        } as UseBinInspectorReturn['layout'],
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByLabelText('Bin layer')).not.toBeInTheDocument();
    });

    it('returns null when bin is null', () => {
      const inspector = createMockInspector({ bin: null });
      const { container } = render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('interactions', () => {
    it('calls updateField when width changes', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.change(screen.getByLabelText('Bin width'), { target: { value: '4' } });

      expect(inspector.updateField).toHaveBeenCalledWith('width', 4);
    });

    it('calls updateField when depth changes', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.change(screen.getByLabelText('Bin depth'), { target: { value: '5' } });

      expect(inspector.updateField).toHaveBeenCalledWith('depth', 5);
    });

    it('calls rotateBin when swap button is clicked', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByLabelText('Swap width and depth'));

      expect(inspector.rotateBin).toHaveBeenCalled();
    });

    it('calls updateField when height decrease is clicked', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByLabelText('Decrease Bin height'));

      expect(inspector.updateField).toHaveBeenCalledWith('height', 3);
    });

    it('calls updateField when height increase is clicked', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByLabelText('Increase Bin height'));

      expect(inspector.updateField).toHaveBeenCalledWith('height', 5);
    });

    it('disables height decrease at min', () => {
      const inspector = createMockInspector({
        bin: { ...mockBin, height: 3 },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Decrease Bin height')).toBeDisabled();
    });

    it('disables height increase at max', () => {
      const inspector = createMockInspector({
        bin: { ...mockBin, height: 12 },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Increase Bin height')).toBeDisabled();
    });

    it('calls updateField when clearance changes', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByLabelText('Increase Bin clearance'));

      expect(inspector.updateField).toHaveBeenCalledWith('clearanceHeight', 2);
    });

    it('calls updateField when category changes', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.change(screen.getByLabelText('Bin category'), { target: { value: 'sky' } });

      expect(inspector.updateField).toHaveBeenCalledWith('category', 'sky');
    });

    it('calls moveToLayer when layer changes', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.change(screen.getByLabelText('Bin layer'), { target: { value: 'layer2' } });

      expect(inspector.moveToLayer).toHaveBeenCalledWith('layer2');
    });

    it('calls updateField when label changes', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.change(screen.getByLabelText('Bin label'), { target: { value: 'New Label' } });

      expect(inspector.updateField).toHaveBeenCalledWith('label', 'New Label');
    });

    it('calls updateField when notes change', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.change(screen.getByLabelText('Bin notes'), { target: { value: 'New notes' } });

      expect(inspector.updateField).toHaveBeenCalledWith('notes', 'New notes');
    });

    it('calls requestDelete when delete button is clicked', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByText('Delete'));

      expect(inspector.requestDelete).toHaveBeenCalled();
    });

    it('calls moveToStaging when stash button is clicked', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByText('To Stash'));

      expect(inspector.moveToStaging).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" onClose={onClose} />);

      fireEvent.click(screen.getByLabelText('Deselect bin'));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('mobile variant', () => {
    it('applies mobile-specific styles', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="mobile" />);

      // Mobile buttons have h-12 class
      expect(screen.getByText('Delete').className).toContain('h-12');
    });
  });

  describe('half-bin mode', () => {
    it('shows fractional dimensions when half-bin mode enabled', () => {
      useUIStore.setState({ halfBinMode: true });
      const inspector = createMockInspector({
        bin: { ...mockBin, width: 2.5, depth: 1.5 },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('2.5×1.5 Bin')).toBeInTheDocument();
    });
  });

  describe('staging bins', () => {
    it('hides To Stash button for bins already in staging', () => {
      const inspector = createMockInspector({
        bin: { ...mockBin, layerId: '__staging__' },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByText('To Stash')).not.toBeInTheDocument();
    });

    it('hides layer dropdown for staging bins', () => {
      const inspector = createMockInspector({
        bin: { ...mockBin, layerId: '__staging__' },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByLabelText('Bin layer')).not.toBeInTheDocument();
    });
  });
});
