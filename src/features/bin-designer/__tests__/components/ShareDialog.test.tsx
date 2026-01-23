import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareDialog } from '../../components/ShareDialog';
import { useDesignerStore } from '../../store/designer';
import { DEFAULT_BIN_PARAMS } from '../../constants/defaults';

// Mock the sharing hook
const mockShare = vi.fn();
const mockLoadShared = vi.fn();
const mockReset = vi.fn();

vi.mock('../../hooks/useDesignerSharing', () => ({
  useDesignerSharing: () => ({
    status: mockStatus,
    shareUrl: mockShareUrl,
    error: mockError,
    share: mockShare,
    loadShared: mockLoadShared,
    reset: mockReset,
  }),
}));

vi.mock('../../constants/defaults', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../constants/defaults')>();
  return {
    ...orig,
    migrateParams: (params: unknown) => ({ ...orig.DEFAULT_BIN_PARAMS, ...(params as object) }),
  };
});

let mockStatus = 'idle';
let mockShareUrl: string | null = null;
let mockError: string | null = null;

function setMockState(status: string, shareUrl: string | null = null, error: string | null = null) {
  mockStatus = status;
  mockShareUrl = shareUrl;
  mockError = error;
}

describe('ShareDialog', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setMockState('idle');
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ShareDialog open={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(<ShareDialog open={true} onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Share Design')).toBeInTheDocument();
  });

  it('resets state when dialog opens', () => {
    render(<ShareDialog open={true} onClose={onClose} />);
    expect(mockReset).toHaveBeenCalled();
  });

  it('shows Create Share Link button in idle state', () => {
    render(<ShareDialog open={true} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /create share link/i })).toBeInTheDocument();
  });

  it('calls share with current params when Create Share Link clicked', () => {
    render(<ShareDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /create share link/i }));
    expect(mockShare).toHaveBeenCalledWith(DEFAULT_BIN_PARAMS);
  });

  it('shows loading spinner when sharing', () => {
    setMockState('sharing');
    render(<ShareDialog open={true} onClose={onClose} />);
    expect(screen.getByText('Creating link...')).toBeInTheDocument();
  });

  it('shows share URL and copy button on success', () => {
    setMockState('success', 'https://example.com/d/abc123');
    render(<ShareDialog open={true} onClose={onClose} />);
    const input = screen.getByDisplayValue('https://example.com/d/abc123');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('copies URL to clipboard when Copy clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    setMockState('success', 'https://example.com/d/abc123');
    render(<ShareDialog open={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://example.com/d/abc123');
    });
  });

  it('shows error message on error status', () => {
    setMockState('error', null, 'Network error. Check your connection.');
    render(<ShareDialog open={true} onClose={onClose} />);
    expect(screen.getByText('Network error. Check your connection.')).toBeInTheDocument();
  });

  it('shows Load section with input and button', () => {
    render(<ShareDialog open={true} onClose={onClose} />);
    expect(screen.getByText('Load Shared Design')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste share URL or ID')).toBeInTheDocument();
    expect(screen.getByText('Load')).toBeInTheDocument();
  });

  it('Load button is disabled when input is empty', () => {
    render(<ShareDialog open={true} onClose={onClose} />);
    const loadBtn = screen.getByText('Load');
    expect(loadBtn).toBeDisabled();
  });

  it('calls loadShared with ID when Load clicked', async () => {
    mockLoadShared.mockResolvedValueOnce({ ...DEFAULT_BIN_PARAMS, width: 4 });

    render(<ShareDialog open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText('Paste share URL or ID');

    fireEvent.change(input, { target: { value: 'share-id-123' } });
    fireEvent.click(screen.getByText('Load'));

    await waitFor(() => {
      expect(mockLoadShared).toHaveBeenCalledWith('share-id-123');
    });
  });

  it('closes dialog after successful load', async () => {
    mockLoadShared.mockResolvedValueOnce({ ...DEFAULT_BIN_PARAMS, width: 3 });

    render(<ShareDialog open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText('Paste share URL or ID');

    fireEvent.change(input, { target: { value: 'my-share-id' } });
    fireEvent.click(screen.getByText('Load'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('does not close dialog if load returns null', async () => {
    mockLoadShared.mockResolvedValueOnce(null);

    render(<ShareDialog open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText('Paste share URL or ID');

    fireEvent.change(input, { target: { value: 'bad-id' } });
    fireEvent.click(screen.getByText('Load'));

    await waitFor(() => {
      expect(mockLoadShared).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('extracts ID from URL when loading', async () => {
    mockLoadShared.mockResolvedValueOnce({ ...DEFAULT_BIN_PARAMS });

    render(<ShareDialog open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText('Paste share URL or ID');

    fireEvent.change(input, { target: { value: 'https://example.com/d/extracted-id' } });
    fireEvent.click(screen.getByText('Load'));

    await waitFor(() => {
      expect(mockLoadShared).toHaveBeenCalledWith('extracted-id');
    });
  });

  it('calls onClose when close button clicked', () => {
    render(<ShareDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('handles Enter key in load input', async () => {
    mockLoadShared.mockResolvedValueOnce({ ...DEFAULT_BIN_PARAMS });

    render(<ShareDialog open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText('Paste share URL or ID');

    fireEvent.change(input, { target: { value: 'enter-id' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockLoadShared).toHaveBeenCalledWith('enter-id');
    });
  });
});
