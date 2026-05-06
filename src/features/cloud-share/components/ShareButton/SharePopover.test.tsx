import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { SharePopover } from './SharePopover';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore, useSharedPreviewStore, useSharePopoverStore } from '@/core/store';
import type { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';

vi.mock('@/shared/hooks/useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: false }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/utils/slug', () => ({
  slugify: (str: string) => str.toLowerCase().replace(/\s+/g, '-'),
}));

type CloudShare = ReturnType<typeof useCloudShare>;

function makeCloudShare(overrides: Partial<CloudShare> = {}): CloudShare {
  return {
    status: 'idle',
    existingShare: null,
    hasActiveShare: false,
    share: vi.fn(),
    updatePermission: vi.fn(),
    copyUrl: vi.fn(),
    remove: vi.fn(),
    error: null,
    reset: vi.fn(),
    ...overrides,
  } as CloudShare;
}

function renderPopover(cloudShare: CloudShare = makeCloudShare()) {
  const buttonRef = createRef<HTMLButtonElement>();
  // Provide a real anchor so the position hook doesn't return null on mount.
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  (buttonRef as { current: HTMLButtonElement | null }).current = anchor;

  const utils = render(<SharePopover buttonRef={buttonRef} cloudShare={cloudShare} />);
  return { ...utils, buttonRef, cleanup: () => anchor.remove() };
}

describe('SharePopover', () => {
  beforeEach(() => {
    resetAllStores();
    useLayoutStore.setState({
      layout: { name: 'Test Layout', bins: [], layers: [], categories: [] },
    });
  });

  it('renders the dialog with the layout name as title row', () => {
    const { cleanup } = renderPopover();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Layout')).toBeInTheDocument();
    cleanup();
  });

  it('shows the create-share affordance in the unshared idle state', () => {
    const { cleanup } = renderPopover();
    expect(screen.getByText('share.createShareLink')).toBeInTheDocument();
    cleanup();
  });

  it('shows the share link section when an active share exists', () => {
    const { cleanup } = renderPopover(
      makeCloudShare({
        hasActiveShare: true,
        existingShare: { id: 'share-123', permission: 'view' },
      })
    );
    expect(screen.getByDisplayValue(/\/l\/share-123\/test-layout$/)).toBeInTheDocument();
    cleanup();
  });

  it('renders read-only permission when viewing someone else’s shared layout', () => {
    useSharedPreviewStore.setState({
      sharedPreview: {
        layout: { name: 'Shared', bins: [], layers: [], categories: [] },
        originalName: 'Shared',
        authorName: null,
        cloudShareId: 'share-456',
        permission: 'view',
      },
    });
    const { cleanup } = renderPopover();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog').textContent).toContain('share.anyoneWithLinkCan');
    cleanup();
  });

  it('shows the loading state when status is sharing', () => {
    const { cleanup } = renderPopover(makeCloudShare({ status: 'sharing' }));
    expect(screen.getByText('share.cloud.publishing')).toBeInTheDocument();
    cleanup();
  });

  it('shows the error state with retry when status is error', () => {
    const { cleanup } = renderPopover(
      makeCloudShare({ status: 'error', error: { message: 'Network down' } as never })
    );
    expect(screen.getByText('Network down')).toBeInTheDocument();
    expect(screen.getByText('error.tryAgain')).toBeInTheDocument();
    cleanup();
  });

  it('closes via the store when the X button is clicked', () => {
    useSharePopoverStore.getState().open();
    const { cleanup } = renderPopover();
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(useSharePopoverStore.getState().isOpen).toBe(false);
    cleanup();
  });

  it('closes via the store when Escape is pressed', () => {
    useSharePopoverStore.getState().open();
    const { cleanup } = renderPopover();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useSharePopoverStore.getState().isOpen).toBe(false);
    cleanup();
  });
});
