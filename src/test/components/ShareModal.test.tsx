import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareModal } from '../../components/Modals';
import { useLayoutStore, useLibraryStore, useUIStore, useLabsStore } from '../../core/store';
import { resetAllStores } from '../testUtils';
import * as storage from '../../core/storage';
import * as analytics from '../../utils/analytics';

// Mock CloudShareTab since it's a complex component
vi.mock('../../features/cloud-share/components/CloudShareTab', () => ({
  CloudShareTab: ({ onSwitchToUrlTab }: { onSwitchToUrlTab: () => void }) => (
    <div data-testid="cloud-share-tab">
      <button onClick={onSwitchToUrlTab}>Switch to URL</button>
    </div>
  ),
}));

// Mock storage utilities
vi.mock('../../core/storage', () => ({
  generateShareableURL: vi.fn(() => 'https://example.com/share?layout=abc'),
  downloadLayoutAsFile: vi.fn(),
  copyToClipboard: vi.fn(() => Promise.resolve(true)),
  exportLayoutJSON: vi.fn(() => '{"version":"1.0","name":"Test"}'),
  getSharedLayoutFromURL: vi.fn(() => null),
  getCloudShareIdFromURL: vi.fn(() => null),
}));

// Mock analytics
vi.mock('../../utils/analytics', () => ({
  trackLayoutSnapshot: vi.fn(),
}));

describe('ShareModal', () => {
  const mockLayout = {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: 'coral', name: 'Coral', color: '#FF6B6B' }],
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    bins: [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'coral', label: '', notes: '' },
    ],
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    useLayoutStore.setState({ layout: mockLayout });
    useLibraryStore.setState({
      isLoaded: true,
      library: {
        version: '1.0',
        activeLayoutId: 'layout-123',
        settings: {},
        entries: [],
      },
    });

    // Ensure collaborative_editing is disabled (Cloud tab visible in ShareModal)
    useLabsStore.setState({
      preferences: {
        enabledFeatures: { collaborative_editing: false },
        lastModified: new Date().toISOString(),
        version: 1,
      },
    });
  });

  describe('rendering', () => {
    it('returns null when not open', () => {
      const { container } = render(
        <ShareModal isOpen={false} onClose={mockOnClose} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders modal when open', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays modal title', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByText('Share Layout')).toBeInTheDocument();
    });

    it('displays all tab buttons', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByRole('tab', { name: 'Cloud' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Link' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'File' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'JSON' })).toBeInTheDocument();
    });

    it('shows Cloud tab by default', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByRole('tab', { name: 'Cloud' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('cloud-share-tab')).toBeInTheDocument();
    });

    it('has close button', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });
  });

  describe('tab navigation', () => {
    it('switches to Link tab', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Link' }));

      expect(screen.getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Share this link with others/)).toBeInTheDocument();
    });

    it('switches to File tab', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('tab', { name: 'File' }));

      expect(screen.getByRole('tab', { name: 'File' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Download your layout/)).toBeInTheDocument();
    });

    it('switches to JSON tab', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));

      expect(screen.getByRole('tab', { name: 'JSON' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Copy the raw JSON data/)).toBeInTheDocument();
    });

    it('switches from Cloud to URL via callback', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      // Click the switch button in the mocked CloudShareTab
      fireEvent.click(screen.getByText('Switch to URL'));

      expect(screen.getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Link tab', () => {
    beforeEach(() => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Link' }));
    });

    it('displays shareable URL', () => {
      expect(screen.getByDisplayValue('https://example.com/share?layout=abc')).toBeInTheDocument();
    });

    it('copies URL when Copy button clicked', async () => {
      fireEvent.click(screen.getByText('Copy'));

      expect(storage.copyToClipboard).toHaveBeenCalledWith('https://example.com/share?layout=abc');
    });

    it('shows copied feedback', async () => {
      fireEvent.click(screen.getByText('Copy'));

      // Wait for state update
      await vi.waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('tracks URL export', async () => {
      fireEvent.click(screen.getByText('Copy'));

      await vi.waitFor(() => {
        expect(analytics.trackLayoutSnapshot).toHaveBeenCalledWith(mockLayout, 'export_url');
      });
    });

    it('selects URL on input click', () => {
      const input = screen.getByDisplayValue('https://example.com/share?layout=abc');
      const selectSpy = vi.spyOn(input as HTMLInputElement, 'select');

      fireEvent.click(input);

      expect(selectSpy).toHaveBeenCalled();
    });

    it('shows URL length warning', () => {
      // Note: beforeEach already renders and switches to Link tab
      expect(screen.getByText(/Very large layouts may create long URLs/)).toBeInTheDocument();
    });
  });

  describe('File tab', () => {
    beforeEach(() => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByRole('tab', { name: 'File' }));
    });

    it('displays layout file name', () => {
      expect(screen.getByText('Test Layout.json')).toBeInTheDocument();
    });

    it('displays layout summary', () => {
      expect(screen.getByText(/10×8 grid • 1 bins • 1 layers/)).toBeInTheDocument();
    });

    it('downloads file when Download button clicked', () => {
      fireEvent.click(screen.getByText('Download'));

      expect(storage.downloadLayoutAsFile).toHaveBeenCalledWith(mockLayout);
    });

    it('tracks file export', () => {
      fireEvent.click(screen.getByText('Download'));

      expect(analytics.trackLayoutSnapshot).toHaveBeenCalledWith(mockLayout, 'export_json');
    });

  });

  describe('JSON tab', () => {
    beforeEach(() => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    });

    it('displays JSON content', () => {
      expect(screen.getByDisplayValue('{"version":"1.0","name":"Test"}')).toBeInTheDocument();
    });

    it('copies JSON when Copy JSON button clicked', async () => {
      fireEvent.click(screen.getByText('Copy JSON'));

      expect(storage.copyToClipboard).toHaveBeenCalledWith('{"version":"1.0","name":"Test"}');
    });

    it('shows copied feedback for JSON', async () => {
      fireEvent.click(screen.getByText('Copy JSON'));

      await vi.waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('tracks JSON export', async () => {
      fireEvent.click(screen.getByText('Copy JSON'));

      await vi.waitFor(() => {
        expect(analytics.trackLayoutSnapshot).toHaveBeenCalledWith(mockLayout, 'export_json');
      });
    });

    it('selects textarea content on click', () => {
      const textarea = screen.getByDisplayValue('{"version":"1.0","name":"Test"}');
      const selectSpy = vi.spyOn(textarea as HTMLTextAreaElement, 'select');

      fireEvent.click(textarea);

      expect(selectSpy).toHaveBeenCalled();
    });
  });

  describe('screen reader announcements', () => {
    it('announces copy to screen reader', async () => {
      const announceSpy = vi.fn();
      useUIStore.setState({ announceToScreenReader: announceSpy });

      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Link' }));
      fireEvent.click(screen.getByText('Copy'));

      await vi.waitFor(() => {
        expect(announceSpy).toHaveBeenCalledWith('Link copied to clipboard');
      });
    });

    it('announces download to screen reader', () => {
      const announceSpy = vi.fn();
      useUIStore.setState({ announceToScreenReader: announceSpy });

      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByRole('tab', { name: 'File' }));
      fireEvent.click(screen.getByText('Download'));

      expect(announceSpy).toHaveBeenCalledWith('Layout downloaded');
    });

    it('announces JSON copy to screen reader', async () => {
      const announceSpy = vi.fn();
      useUIStore.setState({ announceToScreenReader: announceSpy });

      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
      fireEvent.click(screen.getByText('Copy JSON'));

      await vi.waitFor(() => {
        expect(announceSpy).toHaveBeenCalledWith('JSON copied to clipboard');
      });
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button clicked', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByLabelText('Close'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop clicked', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      // The dialog role is on the backdrop div itself
      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when modal content clicked', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      const content = screen.getByText('Share Layout').closest('div[class*="bg-surface-elevated"]')!;
      fireEvent.click(content);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key pressed', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('removes escape listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('accessibility', () => {
    it('has correct aria attributes', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      // The dialog role element has the aria attributes
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'share-modal-title');
    });

    it('has proper tab role attributes', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(4);
    });
  });

  describe('layoutId prop', () => {
    it('uses provided layoutId', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} layoutId="custom-layout-123" />);

      // The modal should render with the custom layout ID
      // The CloudShareTab receives this ID
      expect(screen.getByTestId('cloud-share-tab')).toBeInTheDocument();
    });

    it('falls back to active layout when no layoutId provided', () => {
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);

      // Without layoutId, it uses activeLayoutId from library store
      expect(screen.getByTestId('cloud-share-tab')).toBeInTheDocument();
    });
  });

  describe('copy failure handling', () => {
    it('does not show copied state when copy fails', async () => {
      vi.mocked(storage.copyToClipboard).mockResolvedValueOnce(false);

      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Link' }));
      fireEvent.click(screen.getByText('Copy'));

      // Wait a bit to ensure state would have updated if successful
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    });
  });
});
