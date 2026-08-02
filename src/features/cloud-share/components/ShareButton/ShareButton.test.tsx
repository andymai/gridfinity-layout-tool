import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ShareButton } from './ShareButton';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
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

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/shared/utils/slug', () => ({
  slugify: (str: string) => str.toLowerCase().replace(/\s+/g, '-'),
}));

function mockCloudShare(overrides: Partial<ReturnType<typeof useCloudShare>> = {}) {
  vi.mocked(useCloudShare).mockReturnValue({
    status: 'idle',
    result: null,
    existingShare: null,
    hasActiveShare: false,
    share: vi.fn(),
    updatePermission: vi.fn(),
    copyUrl: vi.fn(),
    remove: vi.fn(),
    error: null,
    reset: vi.fn(),
    ...overrides,
  });
}

describe('ShareButton', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    useLayoutStore.setState({
      layout: createTestLayout({ name: 'Test Layout' }),
    });
  });

  it('renders the share icon button', () => {
    render(<ShareButton />);
    expect(screen.getByRole('button', { name: 'share.button.shareLayout' })).toBeInTheDocument();
  });

  it('renders even when the labs preference is disabled (collaborative_editing is graduated)', () => {
    useLabsStore.getState().disableFeature('collaborative_editing');

    render(<ShareButton />);
    expect(screen.getByRole('button', { name: 'share.button.shareLayout' })).toBeInTheDocument();
  });

  it('opens the popover via the store when clicked', () => {
    render(<ShareButton />);
    fireEvent.click(screen.getByRole('button', { name: 'share.button.shareLayout' }));
    expect(useSharePopoverStore.getState().isOpen).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('toggles the popover closed on a second click', () => {
    render(<ShareButton />);
    const button = screen.getByRole('button', { name: 'share.button.shareLayout' });
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
    mockCloudShare({ status: 'sharing' });

    render(<ShareButton />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the manage-share label when a layout has an active share', () => {
    mockCloudShare({
      hasActiveShare: true,
      existingShare: { id: 'share-123', deleteToken: 'token-123', sharedAt: 0, permission: 'view' },
    });

    render(<ShareButton />);
    expect(screen.getByRole('button', { name: 'share.button.manageShare' })).toBeInTheDocument();
  });

  it('shows the manage-share label when viewing someone else’s shared layout', () => {
    useSharedPreviewStore.setState({
      sharedPreview: {
        layout: createTestLayout({ name: 'Shared' }),
        originalName: 'Shared',
        authorName: null,
        cloudShareId: 'share-456',
        permission: 'view',
      },
    });

    render(<ShareButton />);
    expect(screen.getByRole('button', { name: 'share.button.manageShare' })).toBeInTheDocument();
  });
});
