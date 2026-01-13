import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CloudShareTab } from '../../components/CloudShareTab';
import { useLibraryStore } from '../../store/library';
import { resetAllStores } from '../testUtils';

// Mock useCloudShare hook
const mockShare = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockCopyUrl = vi.fn();
const mockCopyDeleteToken = vi.fn();
const mockReset = vi.fn();

let mockCloudShareState = {
  status: 'idle' as 'idle' | 'sharing' | 'updating' | 'deleting' | 'success' | 'error',
  result: null as { url: string; deleteToken: string; expiresAt: Date } | null,
  error: null as { message: string } | null,
  existingShare: null as { id: string; sharedAt: number; expiresAt: number; deleteToken: string } | null,
  hasActiveShare: false,
  share: mockShare,
  update: mockUpdate,
  remove: mockRemove,
  copyUrl: mockCopyUrl,
  copyDeleteToken: mockCopyDeleteToken,
  reset: mockReset,
};

vi.mock('../../hooks/useCloudShare', () => ({
  useCloudShare: () => mockCloudShareState,
}));

describe('CloudShareTab', () => {
  const mockOnClose = vi.fn();
  const mockOnSwitchToUrlTab = vi.fn();

  const defaultProps = {
    layoutId: 'layout-123',
    onClose: mockOnClose,
    onSwitchToUrlTab: mockOnSwitchToUrlTab,
  };

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Reset mock state
    mockCloudShareState = {
      status: 'idle',
      result: null,
      error: null,
      existingShare: null,
      hasActiveShare: false,
      share: mockShare,
      update: mockUpdate,
      remove: mockRemove,
      copyUrl: mockCopyUrl,
      copyDeleteToken: mockCopyDeleteToken,
      reset: mockReset,
    };

    // Set up library store
    useLibraryStore.setState({
      isLoaded: true,
      library: {
        version: '1.0',
        activeLayoutId: 'layout-123',
        settings: {},
        entries: [],
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('idle state - no existing share', () => {
    it('renders share form', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText(/Share your layout to the cloud/)).toBeInTheDocument();
      expect(screen.getByText('Share to Cloud')).toBeInTheDocument();
    });

    it('displays expiration selector', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByLabelText(/Expires after/)).toBeInTheDocument();
    });

    it('calls share on button click', async () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Share to Cloud'));

      expect(mockShare).toHaveBeenCalledWith(30); // default expiration
    });

    it('displays all expiration options', () => {
      render(<CloudShareTab {...defaultProps} />);

      const select = screen.getByLabelText(/Expires after/) as HTMLSelectElement;
      // EXPIRATION_OPTIONS has multiple entries
      expect(select.options.length).toBeGreaterThan(1);
    });

    it('displays note about snapshots', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText(/Cloud shares are snapshots/)).toBeInTheDocument();
    });
  });

  describe('idle state - has existing share', () => {
    beforeEach(() => {
      mockCloudShareState.status = 'idle';
      mockCloudShareState.hasActiveShare = true;
      mockCloudShareState.existingShare = {
        id: 'share-123',
        sharedAt: Date.now() - 86400000, // 1 day ago
        expiresAt: Date.now() + 86400000 * 29, // 29 days from now
        deleteToken: 'delete-token-abc',
      };
    });

    it('displays share info', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText(/Shared on/)).toBeInTheDocument();
      expect(screen.getByText(/Expires:/)).toBeInTheDocument();
    });

    it('displays days remaining', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText(/days remaining/)).toBeInTheDocument();
    });

    it('has Copy Link button', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Copy Link')).toBeInTheDocument();
    });

    it('calls copyUrl when Copy Link clicked', async () => {
      mockCopyUrl.mockResolvedValue(true);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Copy Link'));

      expect(mockCopyUrl).toHaveBeenCalled();
    });

    it('calls copyUrl and handles response', async () => {
      mockCopyUrl.mockResolvedValue(true);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Copy Link'));

      expect(mockCopyUrl).toHaveBeenCalled();
    });

    it('has Update button', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    it('calls update when Update clicked', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Update'));

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('has Delete share link', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Delete share')).toBeInTheDocument();
    });

    it('shows delete confirmation on Delete share click', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Delete share'));

      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it('calls remove when delete confirmed', async () => {
      mockRemove.mockResolvedValue(true);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Delete share'));
      fireEvent.click(screen.getByText('Delete'));

      expect(mockRemove).toHaveBeenCalled();
    });

    it('hides confirmation on Cancel', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Delete share'));
      expect(screen.getByText(/Are you sure/)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
    });

    it('displays update note', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText(/Updating will replace/)).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('shows uploading message when sharing', () => {
      mockCloudShareState.status = 'sharing';
      render(<CloudShareTab {...defaultProps} />);

      expect(screen.getByText('Uploading layout...')).toBeInTheDocument();
    });

    it('shows updating message when updating', () => {
      mockCloudShareState.status = 'updating';
      render(<CloudShareTab {...defaultProps} />);

      expect(screen.getByText('Updating share...')).toBeInTheDocument();
    });

    it('shows deleting message when deleting', () => {
      mockCloudShareState.status = 'deleting';
      render(<CloudShareTab {...defaultProps} />);

      expect(screen.getByText('Deleting share...')).toBeInTheDocument();
    });

    it('shows spinner during loading states', () => {
      mockCloudShareState.status = 'sharing';
      const { container } = render(<CloudShareTab {...defaultProps} />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).not.toBeNull();
    });
  });

  describe('success state', () => {
    beforeEach(() => {
      mockCloudShareState.status = 'success';
      mockCloudShareState.result = {
        url: 'https://example.com/s/abc123',
        deleteToken: 'delete-token-xyz',
        expiresAt: new Date(Date.now() + 86400000 * 30),
      };
    });

    it('displays success message', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Layout shared successfully!')).toBeInTheDocument();
    });

    it('displays share URL', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByDisplayValue('https://example.com/s/abc123')).toBeInTheDocument();
    });

    it('has Copy button for URL', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    });

    it('copies URL when Copy clicked', async () => {
      mockCopyUrl.mockResolvedValue(true);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

      expect(mockCopyUrl).toHaveBeenCalled();
    });

    it('displays expiration date', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText(/Expires:/)).toBeInTheDocument();
    });

    it('has Done button', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('calls onClose when Done clicked', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Done'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('has Share Another button', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Share Another')).toBeInTheDocument();
    });

    it('calls reset when Share Another clicked', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Share Another'));

      expect(mockReset).toHaveBeenCalled();
    });

    it('selects URL on input click', () => {
      render(<CloudShareTab {...defaultProps} />);

      const input = screen.getByDisplayValue('https://example.com/s/abc123') as HTMLInputElement;
      const selectSpy = vi.spyOn(input, 'select');

      fireEvent.click(input);

      expect(selectSpy).toHaveBeenCalled();
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      mockCloudShareState.status = 'error';
      mockCloudShareState.error = { message: 'Network error occurred' };
    });

    it('displays error message', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Failed to share layout')).toBeInTheDocument();
      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });

    it('has Try Again button', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('calls reset when Try Again clicked', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Try Again'));

      expect(mockReset).toHaveBeenCalled();
    });

    it('has Use Share Link Instead button', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Use Share Link Instead')).toBeInTheDocument();
    });

    it('calls onSwitchToUrlTab when fallback clicked', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Use Share Link Instead'));

      expect(mockOnSwitchToUrlTab).toHaveBeenCalled();
    });
  });

  describe('DeleteTokenSection', () => {
    beforeEach(() => {
      mockCloudShareState.status = 'success';
      mockCloudShareState.result = {
        url: 'https://example.com/s/abc123',
        deleteToken: 'delete-token-xyz',
        expiresAt: new Date(Date.now() + 86400000 * 30),
      };
    });

    it('is collapsed by default', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.queryByText(/Save this token/)).not.toBeInTheDocument();
    });

    it('expands when clicked', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText(/Advanced: Delete Token/));

      expect(screen.getByText(/Save this token/)).toBeInTheDocument();
    });

    it('displays delete token when expanded', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText(/Advanced: Delete Token/));

      expect(screen.getByDisplayValue('delete-token-xyz')).toBeInTheDocument();
    });

    it('has Copy button for token', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText(/Advanced: Delete Token/));

      // There should be a Copy button in the expanded section
      const copyButtons = screen.getAllByRole('button', { name: /Copy/i });
      expect(copyButtons.length).toBeGreaterThan(1); // URL copy and token copy
    });

    it('collapses when clicked again', () => {
      render(<CloudShareTab {...defaultProps} />);

      // Expand
      fireEvent.click(screen.getByText(/Advanced: Delete Token/));
      expect(screen.getByText(/Save this token/)).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText(/Advanced: Delete Token/));
      expect(screen.queryByText(/Save this token/)).not.toBeInTheDocument();
    });

    it('has correct aria-expanded attribute', () => {
      render(<CloudShareTab {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /Advanced: Delete Token/ });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('expiration settings', () => {
    it('has expiration select element', () => {
      render(<CloudShareTab {...defaultProps} />);

      const select = screen.getByLabelText(/Expires after/) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      // Should have multiple options
      expect(select.options.length).toBeGreaterThan(0);
    });

    it('defaults to 30 days', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Share to Cloud'));
      expect(mockShare).toHaveBeenCalledWith(30);
    });
  });

  describe('accessibility', () => {
    it('has accessible label for expiration select', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByLabelText(/Expires after/)).toBeInTheDocument();
    });

    it('URL input has select behavior on click', () => {
      mockCloudShareState.status = 'success';
      mockCloudShareState.result = {
        url: 'https://example.com/s/abc123',
        deleteToken: 'delete-token-xyz',
        expiresAt: new Date(Date.now() + 86400000 * 30),
      };

      render(<CloudShareTab {...defaultProps} />);

      const input = screen.getByDisplayValue('https://example.com/s/abc123');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('copy URL does not throw', () => {
    beforeEach(() => {
      mockCloudShareState.status = 'idle';
      mockCloudShareState.hasActiveShare = true;
      mockCloudShareState.existingShare = {
        id: 'share-123',
        sharedAt: Date.now() - 86400000,
        expiresAt: Date.now() + 86400000 * 29,
        deleteToken: 'delete-token-abc',
      };
    });

    it('handles copyUrl returning false gracefully', async () => {
      mockCopyUrl.mockResolvedValue(false);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Copy Link'));

      // Should not show Copied! when copy fails
      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      });
    });
  });
});
