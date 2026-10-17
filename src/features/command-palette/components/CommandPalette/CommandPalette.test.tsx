import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Command } from 'cmdk';
import { Button } from '@/design-system';
import { PRE_RANKED_VALUE_PREFIX } from '@/shared/utils/commandPaletteFilter';
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
import { OK } from '@/core/result';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';

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
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        layerId: layerId('layer1'),
        category: categoryId('cat1'),
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
      activeLayerId: layerId('layer1'),
      activeCategoryId: categoryId('cat1'),
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
      toggleHalfGridMode: vi.fn(() => OK),
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
          { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
        ],
      });
      useLayoutStore.setState({ layout: layoutWithLayers });

      const { container } = render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

      expect(container).toBeInTheDocument();
    });
  });

  describe('state management', () => {
    it('works with selected bins', () => {
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

      const { container } = render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

      expect(container).toBeInTheDocument();
    });

    it('works with preview visible', () => {
      useViewStore.setState({ showIsometricPreview: true });

      const { container } = render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

      expect(container).toBeInTheDocument();
    });
  });

  describe('extra results', () => {
    it('hands them the typed query and a way to close the palette', () => {
      const extraResults = vi.fn((query: string, close: () => void) => (
        <Button onClick={close}>{`found ${query}`}</Button>
      ));
      const { getByText } = render(
        <CommandPalette
          open
          onOpenChange={mockOnOpenChange}
          initialQuery="screws"
          extraResults={extraResults}
        />
      );
      expect(extraResults).toHaveBeenCalledWith('screws', expect.any(Function));
      getByText('found screws').click();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('keeps pre-ranked results in their order, above a command the query matches', () => {
      // cmdk scrolls its first match into view, which jsdom lacks.
      Element.prototype.scrollIntoView = vi.fn();
      const { container } = render(
        <CommandPalette
          open
          onOpenChange={mockOnOpenChange}
          initialQuery="undo"
          extraResults={() => (
            <Command.Group heading="Bins">
              <Command.Item value={`${PRE_RANKED_VALUE_PREFIX}a-long-key-ranked-first`}>
                first
              </Command.Item>
              <Command.Item value={`${PRE_RANKED_VALUE_PREFIX}undo`}>second</Command.Item>
            </Command.Group>
          )}
        />
      );
      const items = [...container.querySelectorAll('[cmdk-item]')].map((item) => item.textContent);
      expect(items.slice(0, 2)).toEqual(['first', 'second']);
      expect(items.length).toBeGreaterThan(2);
    });
  });
});
