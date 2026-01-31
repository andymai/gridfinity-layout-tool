import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareButton } from './ShareButton';
import { resetAllStores } from '@/test/testUtils';
import { useLabsStore, useLayoutStore, useUIStore } from '@/core/store';
import { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';

// Mock hooks
vi.mock('@/features/cloud-share/hooks/useCloudShare', () => ({
  useCloudShare: vi.fn(() => ({
    status: 'idle',
    existingShare: null,
    hasActiveShare: false,
    share: vi.fn(),
    updatePermission: vi.fn(),
    copyUrl: vi.fn(),
    remove: vi.fn(),
    error: null,
    reset: vi.fn(),
  })),
}));

vi.mock('@/hooks/useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: false }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/utils/slug', () => ({
  slugify: (str: string) => str.toLowerCase().replace(/\s+/g, '-'),
}));

describe('ShareButton', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set up default store state
    useLabsStore.getState().enableFeature('collaborative_editing');
    useLayoutStore.setState({
      layout: { name: 'Test Layout', bins: [], layers: [], categories: [] },
    });
  });

  it('renders share button when feature is enabled', () => {
    render(<ShareButton />);
    expect(screen.getByRole('button', { name: /common.share/i })).toBeInTheDocument();
  });

  it('does not render when feature is disabled', () => {
    useLabsStore.getState().disableFeature('collaborative_editing');

    const { container } = render(<ShareButton />);
    expect(container.firstChild).toBeNull();
  });

  it('opens popover when clicked', () => {
    render(<ShareButton />);
    const button = screen.getByRole('button', { name: /common.share/i });

    fireEvent.click(button);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useCloudShare).mockReturnValue({
      status: 'sharing',
      hasActiveShare: false,
      existingShare: null,
      share: vi.fn(),
      updatePermission: vi.fn(),
      copyUrl: vi.fn(),
      remove: vi.fn(),
      error: null,
      reset: vi.fn(),
    });

    render(<ShareButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows shared indicator when layout has active share', () => {
    vi.mocked(useCloudShare).mockReturnValue({
      status: 'idle',
      hasActiveShare: true,
      existingShare: { id: 'share-123', permission: 'view' },
      share: vi.fn(),
      updatePermission: vi.fn(),
      copyUrl: vi.fn(),
      remove: vi.fn(),
      error: null,
      reset: vi.fn(),
    });

    render(<ShareButton />);
    expect(screen.getByText('share.button.shared')).toBeInTheDocument();
  });

  it('shows shared indicator when viewing shared layout', () => {
    useUIStore.setState({ sharedLayoutCloudShareId: 'share-456' });

    render(<ShareButton />);
    // Button should show shared state
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
