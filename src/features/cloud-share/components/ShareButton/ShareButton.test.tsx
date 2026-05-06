import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ShareButton } from './ShareButton';
import { resetAllStores } from '@/test/testUtils';
import {
  useLabsStore,
  useLayoutStore,
  useSharedPreviewStore,
  useSharePopoverStore,
} from '@/core/store';
import { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';

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

vi.mock('@/shared/hooks/useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: false }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/utils/slug', () => ({
  slugify: (str: string) => str.toLowerCase().replace(/\s+/g, '-'),
}));

describe('ShareButton', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

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

  it('opens the popover via the store when clicked', () => {
    render(<ShareButton />);
    fireEvent.click(screen.getByRole('button', { name: /common.share/i }));
    expect(useSharePopoverStore.getState().isOpen).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('toggles the popover closed on a second click', () => {
    render(<ShareButton />);
    const button = screen.getByRole('button', { name: /common.share/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(useSharePopoverStore.getState().isOpen).toBe(false);
  });

  it('renders the popover when the store is opened externally (e.g. from command palette)', () => {
    render(<ShareButton />);
    act(() => {
      useSharePopoverStore.getState().open();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('reflects loading state while sharing', () => {
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

  it('shows the shared label when a layout has an active share', () => {
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

  it('shows the shared label when viewing someone else’s shared layout', () => {
    useSharedPreviewStore.setState({
      sharedPreview: {
        layout: { name: 'Shared', bins: [], layers: [], categories: [] },
        originalName: 'Shared',
        authorName: null,
        cloudShareId: 'share-456',
        permission: 'view',
      },
    });

    render(<ShareButton />);
    expect(screen.getByText('share.button.shared')).toBeInTheDocument();
  });
});
