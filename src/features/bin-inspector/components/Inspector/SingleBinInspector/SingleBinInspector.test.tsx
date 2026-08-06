import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SingleBinInspector } from '@/features/bin-inspector';
import type { UseBinInspectorReturn } from '@/features/bin-inspector';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { useHalfGridModeStore } from '@/core/store';
import { STAGING_ID } from '@/core/constants';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Category, Layer } from '@/core/types';

// Mock the DeferredNumberInput component to simplify testing
vi.mock('@/shared/components/DeferredNumberInput', () => ({
  DeferredNumberInput: ({
    value,
    onChange,
    ...props
  }: {
    value: number;
    onChange: (v: number) => void;
    [key: string]: unknown;
  }) => (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      {...props}
    />
  ),
}));

describe('SingleBinInspector', () => {
  const mockBin = createTestBin({
    id: binId('bin1'),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(2),
    depth: gridUnits(3),
    height: heightUnits(4),
    layerId: layerId('layer1'),
    category: categoryId('coral'),
    label: 'Test Label',
    notes: 'Test notes',
    clearanceHeight: heightUnits(1),
  });

  const mockCategory: Category = { id: categoryId('coral'), name: 'Coral', color: '#FF6B6B' };
  const mockLayer: Layer = { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) };

  const mockLayout = createTestLayout({
    categories: [mockCategory, { id: categoryId('sky'), name: 'Sky', color: '#38bdf8' }],
    layers: [mockLayer, { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(6) }],
    bins: [mockBin],
  });

  const createMockInspector = (
    overrides?: Partial<UseBinInspectorReturn>
  ): UseBinInspectorReturn => ({
    bin: mockBin,
    selectedBins: [mockBin],
    isMultiSelect: false,
    category: mockCategory,
    layer: mockLayer,
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

      expect(screen.getByLabelText('Width')).toHaveValue(2);
      expect(screen.getByLabelText('Depth')).toHaveValue(3);
    });

    it('renders real-world dimensions', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      // 2 * 42 = 84mm, 3 * 42 = 126mm, 4 * 7 = 28mm
      expect(screen.getByText(/84 × 126 × 28 mm/)).toBeInTheDocument();
    });

    it('renders height control in mm with the unit equivalent', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      // 4u * 7mm = 28mm in the editable field, "= 4u" directly beneath it.
      expect(screen.getByDisplayValue('28')).toBeInTheDocument();
      expect(screen.getByText('= 4u')).toBeInTheDocument();
    });

    it('renders the height limit hints outside the Height/Clearance grid', () => {
      const inspector = createMockInspector();
      const { container } = render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      // min 3u * 7mm = 21mm, max 12u * 7mm = 84mm on one full-width line.
      const limits = screen.getByText(/Min 21mm: layer height · Max 84mm: remaining space/);
      expect(limits).toBeInTheDocument();

      // Keeping these out of the grid is what stops the Clearance cell from
      // being stretched by Height's wrapped hint text.
      const grid = container.querySelector('.grid-cols-2');
      expect(grid).toBeInTheDocument();
      expect(grid).not.toContainElement(limits);
    });

    it('renders clearance control in mm when maxClearance > 0', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      // 1u * 7mm = 7mm in the field, with "= 1u" shown below.
      expect(screen.getByText('Clearance (mm)')).toBeInTheDocument();
      expect(screen.getByText('= 1u')).toBeInTheDocument();
    });

    it('hides clearance control when maxClearance is 0', () => {
      const inspector = createMockInspector({
        constraints: {
          minHeight: 3,
          maxHeight: 12,
          maxClearance: 0,
          maxGridUnits: { width: 6, depth: 6 },
          needsSplit: false,
          heightRange: '3-12u',
          minHeightReason: 'layer_height' as const,
          maxHeightReason: 'remaining_space' as const,
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
        },
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

      const widthInput = screen.getByLabelText('Width');
      fireEvent.change(widthInput, { target: { value: '4' } });
      fireEvent.blur(widthInput);

      expect(inspector.updateField).toHaveBeenCalledWith('width', 4);
    });

    it('calls updateField when depth changes', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      const depthInput = screen.getByLabelText('Depth');
      fireEvent.change(depthInput, { target: { value: '5' } });
      fireEvent.blur(depthInput);

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

    it('converts a typed mm height to fractional units', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      const heightInput = screen.getByLabelText('Bin height');
      // 30.6mm at a 7mm unit -> 4.37u
      fireEvent.change(heightInput, { target: { value: '30.6' } });
      fireEvent.blur(heightInput);

      expect(inspector.updateField).toHaveBeenCalledWith('height', 4.37);
    });

    it('warns when the height will not stack with standard bins', () => {
      const inspector = createMockInspector({ bin: { ...mockBin, height: heightUnits(4.5) } });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      // 4.5u * 7mm = 31.5mm, not a multiple of 7mm.
      expect(screen.getByText("Won't stack with standard bins")).toBeInTheDocument();
    });

    it('does not warn for a standard whole-unit height', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByText("Won't stack with standard bins")).not.toBeInTheDocument();
    });

    it('disables height decrease at min', () => {
      const inspector = createMockInspector({
        bin: { ...mockBin, height: heightUnits(3) },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByLabelText('Decrease Bin height')).toBeDisabled();
    });

    it('disables height increase at max', () => {
      const inspector = createMockInspector({
        bin: { ...mockBin, height: heightUnits(12) },
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
      useHalfGridModeStore.setState({ halfGridMode: true });
      const inspector = createMockInspector({
        bin: { ...mockBin, width: gridUnits(2.5), depth: gridUnits(1.5) },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.getByText('2.5×1.5 Bin')).toBeInTheDocument();
    });
  });

  describe('staging bins', () => {
    it('hides To Stash button for bins already in staging', () => {
      const inspector = createMockInspector({
        bin: { ...mockBin, layerId: STAGING_ID },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByText('To Stash')).not.toBeInTheDocument();
    });

    it('hides layer dropdown for staging bins', () => {
      const inspector = createMockInspector({
        bin: { ...mockBin, layerId: STAGING_ID },
      });
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      expect(screen.queryByLabelText('Bin layer')).not.toBeInTheDocument();
    });
  });

  describe('size lock', () => {
    const lockedInspector = () => createMockInspector({ bin: { ...mockBin, locked: true } });

    it('calls toggleLock from the unlocked state', () => {
      const inspector = createMockInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByRole('button', { name: 'Lock size' }));

      expect(inspector.toggleLock).toHaveBeenCalled();
    });

    it('offers the reverse action while locked', () => {
      const inspector = lockedInspector();
      render(<SingleBinInspector inspector={inspector} variant="desktop" />);

      fireEvent.click(screen.getByRole('button', { name: 'Unlock size' }));

      expect(inspector.toggleLock).toHaveBeenCalled();
    });

    it('disables every dimension control while locked', () => {
      render(<SingleBinInspector inspector={lockedInspector()} variant="desktop" />);

      expect(screen.getByLabelText('Width')).toBeDisabled();
      expect(screen.getByLabelText('Depth')).toBeDisabled();
      expect(screen.getByLabelText('Bin height')).toBeDisabled();
      expect(screen.getByLabelText('Swap width and depth')).toBeDisabled();
    });

    it('leaves the controls live when unlocked', () => {
      render(<SingleBinInspector inspector={createMockInspector()} variant="desktop" />);

      expect(screen.getByLabelText('Width')).not.toBeDisabled();
      expect(screen.getByLabelText('Swap width and depth')).not.toBeDisabled();
    });

    it('explains the lock only while it is on', () => {
      const { unmount } = render(
        <SingleBinInspector inspector={createMockInspector()} variant="desktop" />
      );
      expect(screen.queryByText(/Size locked\./)).not.toBeInTheDocument();
      unmount();

      render(<SingleBinInspector inspector={lockedInspector()} variant="desktop" />);
      expect(screen.getByText(/Size locked\./)).toBeInTheDocument();
    });
  });
});
