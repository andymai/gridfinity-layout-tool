import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintModal } from '@/features/print-export/components/PrintModal';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore, DEFAULT_PRINT_VIEW_SETTINGS } from '@/core/store/settings';
import { createDefaultLayout } from '@/core/constants';
import type { Layout } from '@/core/types';

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: ResizeObserverCallback) {
    // Store callback for potential use in tests
    MockResizeObserver.lastCallback = callback;
  }
  static lastCallback: ResizeObserverCallback | null = null;
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// Mock window.print
const mockPrint = vi.fn();
vi.stubGlobal('print', mockPrint);

// Mock createPortal to render content directly instead of portaling
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

// Mock PrintLayout component to simplify testing
vi.mock('@/features/print-export/components/PrintLayout', () => ({
  PrintLayout: vi.fn(({ layout, selectedLayerIds }: { layout: Layout; selectedLayerIds: string[] }) => (
    <div data-testid="print-layout">
      <span data-testid="layout-name">{layout.name}</span>
      <span data-testid="selected-layers">{selectedLayerIds.join(',')}</span>
    </div>
  )),
}));

// Helper to create test layout
function createTestLayout(): Layout {
  const base = createDefaultLayout();
  return {
    ...base,
    name: 'Test Layout',
    layers: [
      { id: 'layer-1', name: 'Layer 1', height: 3 },
      { id: 'layer-2', name: 'Layer 2', height: 3 },
    ],
    bins: [
      {
        id: 'bin-1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: 'layer-1',
        category: base.categories[0].id,
      },
      {
        id: 'bin-2',
        x: 2,
        y: 0,
        width: 3,
        depth: 2,
        height: 3,
        layerId: 'layer-2',
        category: base.categories[0].id,
      },
    ],
  };
}

describe('PrintModal', () => {
  beforeEach(() => {
    // Reset stores
    const testLayout = createTestLayout();
    useLayoutStore.setState({ layout: testLayout });
    useSettingsStore.setState({
      settings: {
        stlSearchSites: [],
        printViewSettings: { ...DEFAULT_PRINT_VIEW_SETTINGS },
      },
    });

    // Reset mocks
    mockPrint.mockClear();
  });

  afterEach(() => {
    // Reset body overflow
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('renders nothing visible when closed', () => {
      render(<PrintModal isOpen={false} onClose={vi.fn()} />);

      // Print portal still renders for Cmd+P support
      expect(screen.getByTestId('print-layout')).toBeInTheDocument();
      // But modal is not visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Print Layout')).toBeInTheDocument();
    });

    it('has accessible modal attributes', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'print-modal-title');
    });

    it('renders Print and Cancel buttons', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Print')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('layer selection', () => {
    it('shows all layers', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Layer 1')).toBeInTheDocument();
      expect(screen.getByText('Layer 2')).toBeInTheDocument();
    });

    it('selects all layers by default', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Both layers should be selected initially
      // Use getAllBy since there are two print layouts (preview + portal)
      const selectedLayers = screen.getAllByTestId('selected-layers')[0];
      expect(selectedLayers.textContent).toContain('layer-1');
      expect(selectedLayers.textContent).toContain('layer-2');
    });

    it('toggles layer selection on click', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Find layer 1 checkbox row and click it
      const layer1 = screen.getByText('Layer 1').closest('[role="checkbox"]');
      expect(layer1).toBeInTheDocument();

      fireEvent.click(layer1!);

      // Layer 1 should now be deselected
      const selectedLayers = screen.getAllByTestId('selected-layers')[0];
      expect(selectedLayers.textContent).not.toContain('layer-1');
      expect(selectedLayers.textContent).toContain('layer-2');
    });

    it('toggles layer selection on Enter key', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      const layer1 = screen.getByText('Layer 1').closest('[role="checkbox"]');
      fireEvent.keyDown(layer1!, { key: 'Enter' });

      const selectedLayers = screen.getAllByTestId('selected-layers')[0];
      expect(selectedLayers.textContent).not.toContain('layer-1');
    });

    it('toggles layer selection on Space key', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      const layer1 = screen.getByText('Layer 1').closest('[role="checkbox"]');
      fireEvent.keyDown(layer1!, { key: ' ' });

      const selectedLayers = screen.getAllByTestId('selected-layers')[0];
      expect(selectedLayers.textContent).not.toContain('layer-1');
    });

    it('shows Select All button when multiple layers exist', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Select All')).toBeInTheDocument();
    });

    it('selects all layers when Select All clicked', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // First deselect a layer
      const layer1 = screen.getByText('Layer 1').closest('[role="checkbox"]');
      fireEvent.click(layer1!);

      // Then click Select All
      fireEvent.click(screen.getByText('Select All'));

      // Both should be selected
      const selectedLayers = screen.getAllByTestId('selected-layers')[0];
      expect(selectedLayers.textContent).toContain('layer-1');
      expect(selectedLayers.textContent).toContain('layer-2');
    });

    it('disables Print button when no layers selected', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Deselect all layers
      const layer1 = screen.getByText('Layer 1').closest('[role="checkbox"]');
      const layer2 = screen.getByText('Layer 2').closest('[role="checkbox"]');
      fireEvent.click(layer1!);
      fireEvent.click(layer2!);

      // Print button should be disabled
      const printButton = screen.getByText('Print').closest('button');
      expect(printButton).toBeDisabled();
    });

    it('shows bin count for each layer', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Layer 1 has 1 bin, Layer 2 has 1 bin
      // There are 2 instances of "1 bin" (one per layer)
      expect(screen.getAllByText('1 bin')).toHaveLength(2);
    });
  });

  describe('close behavior', () => {
    it('calls onClose when Cancel clicked', () => {
      const onClose = vi.fn();
      render(<PrintModal isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(<PrintModal isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close print dialog');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when overlay clicked', () => {
      const onClose = vi.fn();
      render(<PrintModal isOpen={true} onClose={onClose} />);

      // Click the overlay (outer div)
      const overlay = screen
        .getByRole('dialog')
        .closest('.animate-fade-in');
      fireEvent.click(overlay!);

      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when clicking inside modal', () => {
      const onClose = vi.fn();
      render(<PrintModal isOpen={true} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key pressed', () => {
      const onClose = vi.fn();
      render(<PrintModal isOpen={true} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('body scroll lock', () => {
    it('locks body scroll when open', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('unlocks body scroll when closed', () => {
      const { rerender } = render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<PrintModal isOpen={false} onClose={vi.fn()} />);

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('print functionality', () => {
    it('calls window.print when Print button clicked', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByText('Print'));

      expect(mockPrint).toHaveBeenCalled();
    });
  });

  describe('print settings', () => {
    it('renders Labels checkbox', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Labels')).toBeInTheDocument();
    });

    it('renders Categories checkbox', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Categories')).toBeInTheDocument();
    });

    it('renders Size checkbox', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Size (WxD)')).toBeInTheDocument();
    });

    it('renders Height checkbox', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Height')).toBeInTheDocument();
    });

    it('renders Show Header checkbox', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Show Header')).toBeInTheDocument();
    });

    it('renders Bin Details Table checkbox', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Bin Details Table')).toBeInTheDocument();
    });

    it('toggles setting on checkbox click', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Find and click Labels checkbox
      const labelsCheckbox = screen.getByText('Labels').closest('[role="checkbox"]');
      fireEvent.click(labelsCheckbox!);

      // Verify settings store was updated
      const { settings } = useSettingsStore.getState();
      expect(settings.printViewSettings.showLabel).toBe(false);
    });

    it('toggles setting on Enter key', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      const labelsCheckbox = screen.getByText('Labels').closest('[role="checkbox"]');
      fireEvent.keyDown(labelsCheckbox!, { key: 'Enter' });

      const { settings } = useSettingsStore.getState();
      expect(settings.printViewSettings.showLabel).toBe(false);
    });

    it('toggles setting on Space key', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      const labelsCheckbox = screen.getByText('Labels').closest('[role="checkbox"]');
      fireEvent.keyDown(labelsCheckbox!, { key: ' ' });

      const { settings } = useSettingsStore.getState();
      expect(settings.printViewSettings.showLabel).toBe(false);
    });

    it('shows nested header options when Show Header is enabled', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Header options should be visible by default
      expect(screen.getByText('Layout Name')).toBeInTheDocument();
      expect(screen.getByText('Drawer Info')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
    });

    it('hides nested header options when Show Header is disabled', () => {
      // Start with header disabled
      useSettingsStore.setState({
        settings: {
          stlSearchSites: [],
          printViewSettings: { ...DEFAULT_PRINT_VIEW_SETTINGS, showHeader: false },
        },
      });

      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.queryByText('Layout Name')).not.toBeInTheDocument();
      expect(screen.queryByText('Drawer Info')).not.toBeInTheDocument();
      expect(screen.queryByText('Date')).not.toBeInTheDocument();
    });

  });

  describe('reset on open', () => {
    it('resets layer selection when modal opens', () => {
      const { rerender } = render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Deselect a layer
      const layer1 = screen.getByText('Layer 1').closest('[role="checkbox"]');
      fireEvent.click(layer1!);

      // Close and reopen
      rerender(<PrintModal isOpen={false} onClose={vi.fn()} />);
      rerender(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Layer should be selected again
      const selectedLayers = screen.getAllByTestId('selected-layers')[0];
      expect(selectedLayers.textContent).toContain('layer-1');
      expect(selectedLayers.textContent).toContain('layer-2');
    });
  });

  describe('preview', () => {
    it('renders PrintLayout with correct props', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // Should render print layout (actually multiple - one in preview, one in portal)
      expect(screen.getAllByTestId('print-layout').length).toBeGreaterThanOrEqual(1);
    });

    it('sets up ResizeObserver when open', () => {
      render(<PrintModal isOpen={true} onClose={vi.fn()} />);

      // ResizeObserver callback should be stored
      expect(MockResizeObserver.lastCallback).not.toBeNull();
    });
  });

  describe('print portal', () => {
    it('always renders print portal even when closed', () => {
      render(<PrintModal isOpen={false} onClose={vi.fn()} />);

      // Print layout should still be in DOM for Cmd+P
      expect(screen.getByTestId('print-layout')).toBeInTheDocument();
    });
  });
});

describe('CheckboxOption', () => {
  // Test the internal CheckboxOption behavior through PrintModal
  it('has correct aria attributes', () => {
    render(<PrintModal isOpen={true} onClose={vi.fn()} />);

    const checkbox = screen.getByText('Labels').closest('[role="checkbox"]');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
    expect(checkbox).toHaveAttribute('aria-label', 'Labels');
    expect(checkbox).toHaveAttribute('tabindex', '0');
  });
});
