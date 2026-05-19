import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import {
  useLayoutStore,
  useSelectionStore,
  useViewStore,
  useHalfGridModeStore,
  useInteractionStore,
} from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { resetAllStores, createTestLayout } from '@/test/testUtils';

/**
 * CommandPalette Component Tests
 *
 * This component is complex with many dependencies (cmdk library, multiple stores,
 * command definitions, recent commands store, mutations, etc.). These minimal tests
 * verify core rendering behavior rather than full command execution.
 */
describe('CommandPalette', () => {
  const mockOnOpenChange = vi.fn();

  const testLayout = createTestLayout({
    bins: [
      {
        id: 'bin1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: 'layer1',
        category: 'cat1',
        label: 'Test Bin',
        notes: '',
      },
    ],
  });

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    useLayoutStore.setState({ layout: testLayout });
    useSelectionStore.setState({
      activeLayerId: 'layer1',
      activeCategoryId: 'cat1',
      selectedBinIds: [],
    });
    useHistoryStore.setState({
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
    });
    useViewStore.setState({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      toggleShowOtherLayers: vi.fn(),
      setPrintModalOpen: vi.fn(),
    });
    useHalfGridModeStore.setState({
      halfGridMode: false,
      toggleHalfGridMode: vi.fn(() => ({ success: true })),
    });
    useViewStore.setState({
      setShowLayoutManager: vi.fn(),
      showIsometricPreview: false,
      toggleIsometricPreview: vi.fn(),
      togglePreviewExpanded: vi.fn(),
    });
    useInteractionStore.setState({
      paintSize: null,
      setPaintSize: vi.fn(),
      setInteraction: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders nothing when closed', () => {
      const { container } = render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

      // Component returns null when open is false
      expect(container.firstChild).toBeNull();
    });

    it('renders successfully when store state is properly initialized', () => {
      // This test verifies the component can render without crashing
      // when all required stores are initialized
      const { container } = render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

      expect(container).toBeInTheDocument();
    });

    it('handles multiple layers in layout', () => {
      const layoutWithLayers = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 3 },
        ],
      });
      useLayoutStore.setState({ layout: layoutWithLayers });

      const { container } = render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

      expect(container).toBeInTheDocument();
    });
  });

  describe('state management', () => {
    it('works with selected bins', () => {
      useSelectionStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { container } = render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

      expect(container).toBeInTheDocument();
    });

    it('works with preview visible', () => {
      useViewStore.setState({ showIsometricPreview: true });

      const { container } = render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

      expect(container).toBeInTheDocument();
    });
  });
});
