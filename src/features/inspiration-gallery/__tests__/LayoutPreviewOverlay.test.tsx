import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutPreviewOverlay } from '../components/LayoutPreviewOverlay';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import type { InspirationLayout } from '../types';

// Mock useResponsive hook
vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ isMobile: false }),
}));

// Mock LayoutThumbnailWithLabels
vi.mock('../components/LayoutThumbnailWithLabels', () => ({
  LayoutThumbnailWithLabels: () => <div data-testid="layout-thumbnail" />,
}));

// Mock INSPIRATION_LAYOUTS for related layouts
vi.mock('../data', () => ({
  INSPIRATION_LAYOUTS: [
    {
      id: 'related-1',
      name: 'Related Layout 1',
      theme: 'workshop',
      metrics: {
        binCount: 10,
        layerCount: 1,
        categoryCount: 2,
        labeledBinCount: 5,
        drawerSize: { width: 8, depth: 6, height: 10 },
      },
      layout: {
        name: 'R1',
        drawer: { width: 8, depth: 6, height: 10 },
        layers: [],
        categories: [],
        bins: [],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      },
    },
    {
      id: 'related-2',
      name: 'Related Layout 2',
      theme: 'workshop',
      metrics: {
        binCount: 15,
        layerCount: 2,
        categoryCount: 3,
        labeledBinCount: 8,
        drawerSize: { width: 10, depth: 8, height: 12 },
      },
      layout: {
        name: 'R2',
        drawer: { width: 10, depth: 8, height: 12 },
        layers: [],
        categories: [],
        bins: [],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      },
    },
    {
      id: 'kitchen-1',
      name: 'Kitchen Layout',
      theme: 'kitchen',
      metrics: {
        binCount: 8,
        layerCount: 1,
        categoryCount: 2,
        labeledBinCount: 4,
        drawerSize: { width: 10, depth: 8, height: 10 },
      },
      layout: {
        name: 'K1',
        drawer: { width: 10, depth: 8, height: 10 },
        layers: [],
        categories: [],
        bins: [],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      },
    },
  ],
}));

const createMockLayout = (overrides: Partial<InspirationLayout> = {}): InspirationLayout => ({
  id: 'test-layout',
  name: 'Test Layout',
  theme: 'workshop',
  description: 'A detailed description of the test layout for organizing workshop items.',
  shortDescription: 'A short description',
  complexity: 'beginner',
  features: [],
  metrics: {
    binCount: 12,
    layerCount: 2,
    categoryCount: 3,
    labeledBinCount: 8,
    drawerSize: { width: 10, depth: 8, height: 12 },
  },
  preview: {
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 12,
    layerCount: 2,
    binMap: [],
  },
  layout: {
    name: 'Test',
    drawer: { width: 10, depth: 8, height: 12 },
    layers: [{ id: 'l1', name: 'Layer 1', height: 3 }],
    categories: [{ id: 'c1', name: 'Cat', color: '#ff0000' }],
    bins: [
      {
        id: 'b1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: 'l1',
        category: 'c1',
        label: 'Screws',
        notes: '',
      },
      {
        id: 'b2',
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: 'l1',
        category: 'c1',
        label: 'Nuts',
        notes: '',
      },
      {
        id: 'b3',
        x: 4,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        layerId: 'l1',
        category: 'c1',
        label: 'Bolts',
        notes: '',
      },
    ],
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
  },
  tags: ['test'],
  ...overrides,
});

describe('LayoutPreviewOverlay', () => {
  const defaultProps = {
    layout: createMockLayout(),
    onClose: vi.fn(),
    onUseLayout: vi.fn(),
    onSelectRelated: vi.fn(),
    isImporting: false,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    // Set a default drawer size
    const layout = useLayoutStore.getState().layout;
    layout.drawer = { width: 10, depth: 8, height: 12 };
    useLayoutStore.setState({ layout });
  });

  describe('rendering', () => {
    it('renders the layout name as title', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('Test Layout')).toBeInTheDocument();
    });

    it('renders the description', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(
        screen.getByText('A detailed description of the test layout for organizing workshop items.')
      ).toBeInTheDocument();
    });

    it('renders the theme badge', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('Workshop')).toBeInTheDocument();
    });

    it('renders layout thumbnail', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getAllByTestId('layout-thumbnail').length).toBeGreaterThan(0);
    });

    it('has dialog role with aria attributes', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'preview-title');
    });
  });

  describe('metrics display', () => {
    it('displays bin count', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Bins')).toBeInTheDocument();
    });

    it('displays layer count', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Layers')).toBeInTheDocument();
    });

    it('displays category count', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });
  });

  describe('drawer comparison', () => {
    it('shows matching drawer message when sizes match', () => {
      // Store drawer matches layout drawer (10x8)
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('Matches your drawer')).toBeInTheDocument();
    });

    it('shows size info when drawer sizes differ', () => {
      // Change store drawer to different size
      const layout = useLayoutStore.getState().layout;
      layout.drawer = { width: 12, depth: 10, height: 15 };
      useLayoutStore.setState({ layout });

      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText((content) => content.includes('10×8') && content.includes('drawer'))).toBeInTheDocument();
      expect(screen.getByText(/420×336mm/)).toBeInTheDocument();
    });

    it('shows comparison when sizes differ', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer = { width: 15, depth: 12, height: 18 };
      useLayoutStore.setState({ layout });

      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText((content) => content.includes('yours: 15×12'))).toBeInTheDocument();
    });
  });

  describe('labeled bins', () => {
    it('displays example items section', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('Example Items')).toBeInTheDocument();
    });

    it('shows labeled bin names', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('Screws')).toBeInTheDocument();
      expect(screen.getByText('Nuts')).toBeInTheDocument();
      expect(screen.getByText('Bolts')).toBeInTheDocument();
    });

    it('limits display to 8 items', () => {
      const manyBins = Array.from({ length: 12 }, (_, i) => ({
        id: `b${i}`,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId: 'l1',
        category: 'c1',
        label: `Item ${i + 1}`,
        notes: '',
      }));

      const layoutWithManyBins = createMockLayout({
        layout: {
          ...createMockLayout().layout,
          bins: manyBins,
        },
      });

      render(<LayoutPreviewOverlay {...defaultProps} layout={layoutWithManyBins} />);

      expect(screen.getByText('+4 more')).toBeInTheDocument();
    });

    it('hides example items when no labeled bins', () => {
      const layoutNoLabels = createMockLayout({
        layout: {
          ...createMockLayout().layout,
          bins: [
            {
              id: 'b1',
              x: 0,
              y: 0,
              width: 2,
              depth: 2,
              height: 3,
              layerId: 'l1',
              category: 'c1',
              label: '',
              notes: '',
            },
          ],
        },
      });

      render(<LayoutPreviewOverlay {...defaultProps} layout={layoutNoLabels} />);

      expect(screen.queryByText('Example Items')).not.toBeInTheDocument();
    });
  });

  describe('related layouts', () => {
    it('shows related layouts section', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText((content) => content.includes('More') && content.includes('Workshop'))).toBeInTheDocument();
    });

    it('displays related layout names', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(screen.getByText('Related Layout 1')).toBeInTheDocument();
      expect(screen.getByText('Related Layout 2')).toBeInTheDocument();
    });

    it('calls onSelectRelated when clicking related layout', () => {
      const onSelectRelated = vi.fn();
      render(<LayoutPreviewOverlay {...defaultProps} onSelectRelated={onSelectRelated} />);

      fireEvent.click(screen.getByText('Related Layout 1'));

      expect(onSelectRelated).toHaveBeenCalledTimes(1);
    });

    it('hides related section when onSelectRelated not provided', () => {
      render(<LayoutPreviewOverlay {...defaultProps} onSelectRelated={undefined} />);

      expect(screen.queryByText('More Workshop')).not.toBeInTheDocument();
    });

    it('only shows layouts of same theme', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      // Kitchen layout should not appear for workshop theme
      expect(screen.queryByText('Kitchen Layout')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<LayoutPreviewOverlay {...defaultProps} onClose={onClose} />);

      // Click the outer container (backdrop)
      const backdrop = container.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside dialog', () => {
      const onClose = vi.fn();
      render(<LayoutPreviewOverlay {...defaultProps} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<LayoutPreviewOverlay {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when back button is clicked', () => {
      const onClose = vi.fn();
      render(<LayoutPreviewOverlay {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByLabelText('Back to gallery'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onUseLayout when CTA button is clicked', () => {
      const onUseLayout = vi.fn();
      render(<LayoutPreviewOverlay {...defaultProps} onUseLayout={onUseLayout} />);

      fireEvent.click(screen.getByText((content) => content.includes('Use as Starting Point')));

      expect(onUseLayout).toHaveBeenCalledTimes(1);
    });
  });

  describe('import state', () => {
    it('shows normal button when not importing', () => {
      render(<LayoutPreviewOverlay {...defaultProps} isImporting={false} />);

      expect(screen.getByText((content) => content.includes('Use as Starting Point'))).toBeInTheDocument();
      expect(screen.queryByText('Adding...')).not.toBeInTheDocument();
    });

    it('shows loading state when importing', () => {
      render(<LayoutPreviewOverlay {...defaultProps} isImporting={true} />);

      expect(screen.getByText('Adding...')).toBeInTheDocument();
      expect(screen.queryByText('Use as Starting Point')).not.toBeInTheDocument();
    });

    it('disables button when importing', () => {
      render(<LayoutPreviewOverlay {...defaultProps} isImporting={true} />);

      const button = screen.getByRole('button', { name: /adding/i });
      expect(button).toBeDisabled();
    });
  });

  describe('focus management', () => {
    it('focuses close button on mount', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      const closeButton = screen.getByLabelText('Back to gallery');
      expect(document.activeElement).toBe(closeButton);
    });
  });

  describe('footer', () => {
    it('displays helpful text', () => {
      render(<LayoutPreviewOverlay {...defaultProps} />);

      expect(
        screen.getByText((content) => content.includes('Use as a starting point') && content.includes('customize to fit your items'))
      ).toBeInTheDocument();
    });
  });
});
