import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CloudShareTab } from '@/features/cloud-share/components/CloudShareTab';
import { useLibraryStore } from '@/core/store/library';
import { resetAllStores } from '@/test/testUtils';

// Mock useCloudShare hook
const mockShare = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockCopyUrl = vi.fn();
const mockReset = vi.fn();

let mockCloudShareState = {
  status: 'idle' as 'idle' | 'sharing' | 'updating' | 'deleting' | 'success' | 'error',
  result: null as { url: string; deleteToken: string; permission: 'view' | 'edit' } | null,
  error: null as { message: string } | null,
  existingShare: null as {
    id: string;
    sharedAt: number;
    permission: 'view' | 'edit';
    deleteToken: string;
  } | null,
  hasActiveShare: false,
  share: mockShare,
  update: mockUpdate,
  updatePermission: vi.fn(),
  remove: mockRemove,
  copyUrl: mockCopyUrl,
  reset: mockReset,
};

vi.mock('../../features/cloud-share/hooks/useCloudShare', () => ({
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
      updatePermission: vi.fn(),
      remove: mockRemove,
      copyUrl: mockCopyUrl,
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
      expect(screen.getByText(/Share via a short link/)).toBeInTheDocument();
      expect(screen.getByText('Publish')).toBeInTheDocument();
    });

    it('displays permission selector', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByLabelText('Permissions')).toBeInTheDocument();
    });

    it('calls share with view permission by default', async () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Publish'));

      expect(mockShare).toHaveBeenCalledWith('view');
    });

    it('displays permission options', () => {
      render(<CloudShareTab {...defaultProps} />);

      const select = screen.getByLabelText('Permissions') as HTMLSelectElement;
      expect(select.options.length).toBe(2); // view and edit
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
        permission: 'view',
        deleteToken: 'delete-token-abc',
      };
    });

    it('displays share info', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText(/Last updated/)).toBeInTheDocument();
      // "View only" appears as both display text and dropdown option
      expect(screen.getAllByText('View only').length).toBeGreaterThanOrEqual(1);
    });

    it('displays permission info', () => {
      render(<CloudShareTab {...defaultProps} />);
      // "View only" appears as both display text and dropdown option
      expect(screen.getAllByText('View only').length).toBeGreaterThanOrEqual(1);
    });

    it('has Copy Link button', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Copy link')).toBeInTheDocument();
    });

    it('calls copyUrl when Copy Link clicked', async () => {
      mockCopyUrl.mockResolvedValue(true);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Copy link'));

      expect(mockCopyUrl).toHaveBeenCalled();
    });

    it('calls copyUrl and handles response', async () => {
      mockCopyUrl.mockResolvedValue(true);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Copy link'));

      expect(mockCopyUrl).toHaveBeenCalled();
    });

    it('has permission select dropdown', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByLabelText('Permissions')).toBeInTheDocument();
    });

    it('has Unpublish link', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Unpublish')).toBeInTheDocument();
    });

    it('shows delete confirmation on Unpublish click', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Unpublish'));

      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it('calls remove when delete confirmed', async () => {
      mockRemove.mockResolvedValue(true);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Unpublish'));
      fireEvent.click(screen.getByText('Delete'));

      expect(mockRemove).toHaveBeenCalled();
    });

    it('hides confirmation on Cancel', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Unpublish'));
      expect(screen.getByText(/Are you sure/)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
    });

    it('displays permission change note', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText(/Changing permission/)).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('shows publishing message when sharing', () => {
      mockCloudShareState.status = 'sharing';
      render(<CloudShareTab {...defaultProps} />);

      expect(screen.getByText('Publishing...')).toBeInTheDocument();
    });

    it('shows updating message when updating', () => {
      mockCloudShareState.status = 'updating';
      render(<CloudShareTab {...defaultProps} />);

      expect(screen.getByText('Updating...')).toBeInTheDocument();
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
        permission: 'view',
      };
    });

    it('displays success message', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('Published!')).toBeInTheDocument();
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

    it('displays permission info', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByText('View only')).toBeInTheDocument();
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
      expect(screen.getByText('Share another')).toBeInTheDocument();
    });

    it('calls reset when Share Another clicked', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Share another'));

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
      expect(screen.getByText('Use share link instead')).toBeInTheDocument();
    });

    it('calls onSwitchToUrlTab when fallback clicked', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Use share link instead'));

      expect(mockOnSwitchToUrlTab).toHaveBeenCalled();
    });
  });

  describe('permission settings', () => {
    it('has permission select element', () => {
      render(<CloudShareTab {...defaultProps} />);

      const select = screen.getByLabelText('Permissions') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      // Should have view and edit options
      expect(select.options.length).toBe(2);
    });

    it('defaults to view permission', () => {
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Publish'));
      expect(mockShare).toHaveBeenCalledWith('view');
    });
  });

  describe('accessibility', () => {
    it('has accessible label for permission select', () => {
      render(<CloudShareTab {...defaultProps} />);
      expect(screen.getByLabelText('Permissions')).toBeInTheDocument();
    });

    it('URL input has select behavior on click', () => {
      mockCloudShareState.status = 'success';
      mockCloudShareState.result = {
        url: 'https://example.com/s/abc123',
        deleteToken: 'delete-token-xyz',
        permission: 'view',
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
        permission: 'view',
        deleteToken: 'delete-token-abc',
      };
    });

    it('handles copyUrl returning false gracefully', async () => {
      mockCopyUrl.mockResolvedValue(false);
      render(<CloudShareTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Copy link'));

      // Should not show Link copied! when copy fails
      await waitFor(() => {
        expect(screen.queryByText('Link copied!')).not.toBeInTheDocument();
      });
    });
  });
});
