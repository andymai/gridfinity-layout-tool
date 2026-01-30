import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { InspirationGallery } from '../components/InspirationGallery';
import { useUIStore } from '@/core/store/ui';
import { useToastStore } from '@/core/store/toast';
import type { InspirationLayout } from '../types';

// Mock hooks
vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ isMobile: false, viewportWidth: 1280 }),
}));

// Mock analytics
const mockTrackEvent = vi.fn();
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockImportLayoutFromJSON = vi.fn();
const mockSwitchLayout = vi.fn();

vi.mock('@/hooks/useLayoutSwitcher', () => ({
  useLayoutSwitcher: () => ({
    importLayoutFromJSON: mockImportLayoutFromJSON,
    switchLayout: mockSwitchLayout,
  }),
}));

// Mock data - defined inside the mock factory to avoid hoisting issues
vi.mock('../data', () => {
  const mockLayouts = [
    {
      id: 'workshop-1',
      name: 'Workshop Layout 1',
      theme: 'workshop',
      description: 'A workshop layout',
      shortDescription: 'Workshop desc',
      complexity: 'beginner',
      features: [],
      metrics: {
        binCount: 10,
        layerCount: 1,
        categoryCount: 2,
        labeledBinCount: 5,
        drawerSize: { width: 10, depth: 8, height: 12 },
      },
      preview: {
        drawerWidth: 10,
        drawerDepth: 8,
        drawerHeight: 12,
        binCount: 10,
        layerCount: 1,
        binMap: [],
      },
      layout: {
        name: 'W1',
        drawer: { width: 10, depth: 8, height: 12 },
        layers: [],
        categories: [],
        bins: [],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      },
      tags: [],
    },
    {
      id: 'workshop-2',
      name: 'Workshop Layout 2',
      theme: 'workshop',
      description: 'Another workshop layout',
      shortDescription: 'Workshop desc 2',
      complexity: 'intermediate',
      features: [],
      metrics: {
        binCount: 15,
        layerCount: 2,
        categoryCount: 3,
        labeledBinCount: 8,
        drawerSize: { width: 12, depth: 10, height: 15 },
      },
      preview: {
        drawerWidth: 12,
        drawerDepth: 10,
        drawerHeight: 15,
        binCount: 15,
        layerCount: 2,
        binMap: [],
      },
      layout: {
        name: 'W2',
        drawer: { width: 12, depth: 10, height: 15 },
        layers: [],
        categories: [],
        bins: [],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      },
      tags: [],
    },
    {
      id: 'kitchen-1',
      name: 'Kitchen Layout 1',
      theme: 'kitchen',
      description: 'A kitchen layout',
      shortDescription: 'Kitchen desc',
      complexity: 'beginner',
      features: [],
      metrics: {
        binCount: 8,
        layerCount: 1,
        categoryCount: 2,
        labeledBinCount: 4,
        drawerSize: { width: 8, depth: 6, height: 10 },
      },
      preview: {
        drawerWidth: 8,
        drawerDepth: 6,
        drawerHeight: 10,
        binCount: 8,
        layerCount: 1,
        binMap: [],
      },
      layout: {
        name: 'K1',
        drawer: { width: 8, depth: 6, height: 10 },
        layers: [],
        categories: [],
        bins: [],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      },
      tags: [],
    },
  ];
  return {
    INSPIRATION_LAYOUTS: mockLayouts,
    getLayoutsByTheme: (theme: string) =>
      theme === 'all'
        ? mockLayouts
        : mockLayouts.filter((l: { theme: string }) => l.theme === theme),
  };
});

// Mock child components
vi.mock('../components/ThemeFilterPills', () => ({
  ThemeFilterPills: ({
    selectedTheme,
    onThemeChange,
    themeCounts,
  }: {
    selectedTheme: string;
    onThemeChange: (theme: string) => void;
    themeCounts: Record<string, number>;
  }) => (
    <div data-testid="theme-filter-pills">
      <button onClick={() => onThemeChange('all')} data-selected={selectedTheme === 'all'}>
        All ({themeCounts.all})
      </button>
      <button
        onClick={() => onThemeChange('workshop')}
        data-selected={selectedTheme === 'workshop'}
      >
        Workshop ({themeCounts.workshop})
      </button>
      <button onClick={() => onThemeChange('kitchen')} data-selected={selectedTheme === 'kitchen'}>
        Kitchen ({themeCounts.kitchen})
      </button>
    </div>
  ),
}));

vi.mock('../components/LayoutCard', () => ({
  LayoutCard: ({
    layout,
    onClick,
    index,
  }: {
    layout: InspirationLayout;
    onClick: () => void;
    index: number;
  }) => (
    <button
      data-testid={`layout-card-${layout.id}`}
      data-layout-card
      onClick={onClick}
      data-index={index}
    >
      {layout.name}
    </button>
  ),
}));

vi.mock('../components/LayoutPreviewOverlay', () => ({
  LayoutPreviewOverlay: ({
    layout,
    onClose,
    onUseLayout,
    isImporting,
  }: {
    layout: InspirationLayout;
    onClose: () => void;
    onUseLayout: () => void;
    isImporting: boolean;
  }) => (
    <div data-testid="preview-overlay">
      <div data-testid="preview-layout-name">{layout.name}</div>
      <button onClick={onClose} data-testid="preview-close">
        Close
      </button>
      <button onClick={onUseLayout} disabled={isImporting} data-testid="preview-use">
        {isImporting ? 'Importing...' : 'Use Layout'}
      </button>
    </div>
  ),
}));

// Spy on store methods
const mockAnnounceToScreenReader = vi.fn();
const mockCloseMobilePanel = vi.fn();
const mockAddToast = vi.fn();

describe('InspirationGallery', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockImportLayoutFromJSON.mockResolvedValue({ ok: true, value: 'new-layout-id' });
    mockSwitchLayout.mockResolvedValue({ ok: true, value: undefined });
    // Reset body overflow
    document.body.style.overflow = '';

    // Spy on store methods
    vi.spyOn(useUIStore.getState(), 'announceToScreenReader').mockImplementation(
      mockAnnounceToScreenReader
    );
    vi.spyOn(useUIStore.getState(), 'closeMobilePanel').mockImplementation(mockCloseMobilePanel);
    vi.spyOn(useToastStore.getState(), 'addToast').mockImplementation(mockAddToast);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('returns null when not open', () => {
      const { container } = render(<InspirationGallery isOpen={false} onClose={vi.fn()} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders content when open', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders the title', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByText('Inspiration Gallery')).toBeInTheDocument();
    });

    it('renders the subtitle', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByText("See what's possible, then make it yours")).toBeInTheDocument();
    });

    it('renders theme filter pills', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByTestId('theme-filter-pills')).toBeInTheDocument();
    });

    it('renders layout cards', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByTestId('layout-card-workshop-1')).toBeInTheDocument();
      expect(screen.getByTestId('layout-card-workshop-2')).toBeInTheDocument();
      expect(screen.getByTestId('layout-card-kitchen-1')).toBeInTheDocument();
    });

    it('renders layout count in footer', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByText((content) => content.includes('3 layout(s)'))).toBeInTheDocument();
    });

    it('has close button', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('has dialog role with aria attributes', () => {
      render(<InspirationGallery {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'inspiration-gallery-title');
    });
  });

  describe('theme filtering', () => {
    it('shows all layouts by default', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByTestId('layout-card-workshop-1')).toBeInTheDocument();
      expect(screen.getByTestId('layout-card-workshop-2')).toBeInTheDocument();
      expect(screen.getByTestId('layout-card-kitchen-1')).toBeInTheDocument();
    });

    it('filters layouts when theme changes', async () => {
      render(<InspirationGallery {...defaultProps} />);

      // Click workshop filter
      fireEvent.click(screen.getByText('Workshop (2)'));

      await waitFor(() => {
        expect(screen.getByTestId('layout-card-workshop-1')).toBeInTheDocument();
        expect(screen.getByTestId('layout-card-workshop-2')).toBeInTheDocument();
        expect(screen.queryByTestId('layout-card-kitchen-1')).not.toBeInTheDocument();
      });
    });

    it('updates layout count when filtered', async () => {
      render(<InspirationGallery {...defaultProps} />);

      fireEvent.click(screen.getByText('Workshop (2)'));

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes('2 layout(s) in Workshop'))
        ).toBeInTheDocument();
      });
    });

    it('announces to screen reader when theme changes', async () => {
      render(<InspirationGallery {...defaultProps} />);

      fireEvent.click(screen.getByText('Kitchen (1)'));

      await waitFor(() => {
        expect(mockAnnounceToScreenReader).toHaveBeenCalledWith(expect.stringContaining('Kitchen'));
      });
    });
  });

  describe('modal behavior', () => {
    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<InspirationGallery isOpen={true} onClose={onClose} />);

      // Click the backdrop (first fixed div)
      const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/50');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal', () => {
      const onClose = vi.fn();
      render(<InspirationGallery isOpen={true} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<InspirationGallery isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(<InspirationGallery isOpen={true} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('locks body scroll when open', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when unmounted', () => {
      const { unmount } = render(<InspirationGallery {...defaultProps} />);

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('preview overlay', () => {
    it('opens preview when card is clicked', async () => {
      render(<InspirationGallery {...defaultProps} />);

      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));

      await waitFor(() => {
        expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('preview-layout-name')).toHaveTextContent('Workshop Layout 1');
      });
    });

    it('closes preview with Escape key (before closing gallery)', async () => {
      render(<InspirationGallery {...defaultProps} />);

      // Open preview
      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
      });

      // Press Escape - should close preview, not gallery
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('preview-overlay')).not.toBeInTheDocument();
      });

      // Gallery should still be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes preview when close button is clicked', async () => {
      render(<InspirationGallery {...defaultProps} />);

      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('preview-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('preview-overlay')).not.toBeInTheDocument();
      });
    });
  });

  describe('import flow', () => {
    it('imports layout when use button is clicked', async () => {
      render(<InspirationGallery {...defaultProps} />);

      // Open preview
      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
      });

      // Click use layout
      fireEvent.click(screen.getByTestId('preview-use'));

      await waitFor(() => {
        expect(mockImportLayoutFromJSON).toHaveBeenCalledTimes(1);
        expect(mockSwitchLayout).toHaveBeenCalledTimes(1);
      });
    });

    it('shows success toast on successful import', async () => {
      render(<InspirationGallery {...defaultProps} />);

      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('preview-use'));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('Added "Workshop Layout 1"', 'success');
      });
    });

    it('closes gallery after successful import', async () => {
      const onClose = vi.fn();
      render(<InspirationGallery isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('preview-use'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('shows error toast on failed import', async () => {
      mockImportLayoutFromJSON.mockResolvedValue({ ok: false, error: { code: 'IMPORT_ERROR' } });

      render(<InspirationGallery {...defaultProps} />);

      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('preview-use'));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('Failed to add layout', 'error');
      });
    });

    it('closes mobile panel on import', async () => {
      render(<InspirationGallery {...defaultProps} />);

      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));
      await waitFor(() => {
        expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('preview-use'));

      await waitFor(() => {
        expect(mockCloseMobilePanel).toHaveBeenCalled();
      });
    });
  });

  describe('focus management', () => {
    it('focuses close button on mount', () => {
      render(<InspirationGallery {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close');
      expect(document.activeElement).toBe(closeButton);
    });

    it('announces to screen reader on mount', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith(
        expect.stringContaining('Inspiration Gallery opened')
      );
    });
  });

  describe('grid column slider', () => {
    it('renders grid column slider on desktop', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(screen.getByLabelText('Grid columns')).toBeInTheDocument();
    });

    it('changes grid columns when slider is moved', () => {
      render(<InspirationGallery {...defaultProps} />);

      const slider = screen.getByLabelText('Grid columns');
      fireEvent.change(slider, { target: { value: '6' } });

      expect(slider).toHaveValue('6');
    });
  });

  describe('layout grid', () => {
    it('has grid role with aria-label', () => {
      render(<InspirationGallery {...defaultProps} />);

      const grid = screen.getByRole('grid', { name: 'Layout gallery' });
      expect(grid).toBeInTheDocument();
    });
  });

  describe('analytics tracking', () => {
    it('tracks gallery_opened on mount', () => {
      render(<InspirationGallery {...defaultProps} />);

      expect(mockTrackEvent).toHaveBeenCalledWith('gallery_opened', {
        layout_count: 3, // Mock has 3 layouts
      });
    });

    it('tracks gallery_filter_changed when theme filter changes', () => {
      render(<InspirationGallery {...defaultProps} />);
      mockTrackEvent.mockClear();

      // Click workshop filter
      fireEvent.click(screen.getByText('Workshop (2)'));

      expect(mockTrackEvent).toHaveBeenCalledWith('gallery_filter_changed', {
        theme: 'workshop',
        result_count: 2,
      });
    });

    it('tracks template_preview when layout card is clicked', () => {
      render(<InspirationGallery {...defaultProps} />);
      mockTrackEvent.mockClear();

      // Click a layout card to preview it
      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));

      expect(mockTrackEvent).toHaveBeenCalledWith('template_preview', {
        template_id: 'workshop-1',
        template_name: 'Workshop Layout 1',
        template_theme: 'workshop',
        bin_count: 10,
      });
    });

    it('tracks template_applied when layout is used', async () => {
      render(<InspirationGallery {...defaultProps} />);

      // Open preview
      fireEvent.click(screen.getByTestId('layout-card-workshop-1'));
      mockTrackEvent.mockClear();

      // Click "Use Layout" button (mocked preview overlay button)
      const useButton = screen.getByTestId('preview-use');
      fireEvent.click(useButton);

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith('template_applied', {
          template_id: 'workshop-1',
          template_name: 'Workshop Layout 1',
          template_theme: 'workshop',
          bin_count: 10,
          layer_count: 1,
        });
      });
    });
  });
});
