import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { flushSync } from 'react-dom';
import { SharePopover } from './SharePopover';
import { ShareButton } from './ShareButton';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import {
  useLayoutStore,
  useLibraryStore,
  useSharedPreviewStore,
  useSharePopoverStore,
} from '@/core/store';
import type { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';
import { createShare } from '@/core/api/share';
import { apiContentBlocked, err, ok } from '@/core/result';

vi.mock('@/shared/hooks/useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: false }),
}));

vi.mock('@/core/api/share', () => ({
  createShare: vi.fn(),
  updatePermission: vi.fn(),
  deleteShare: vi.fn(),
}));

vi.mock('@/core/storage', async () => ({
  ...(await vi.importActual('@/core/storage')),
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/shared/utils/slug', () => ({
  slugify: (str: string) => str.toLowerCase().replace(/\s+/g, '-'),
}));

type CloudShare = ReturnType<typeof useCloudShare>;

function makeCloudShare(overrides: Partial<CloudShare> = {}): CloudShare {
  return {
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
  };
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
      layout: createTestLayout({ name: 'Test Layout' }),
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
        existingShare: {
          id: 'share-123',
          deleteToken: 'token-123',
          sharedAt: 0,
          permission: 'view',
        },
      })
    );
    expect(screen.getByDisplayValue(/\/l\/share-123\/test-layout$/)).toBeInTheDocument();
    cleanup();
  });

  it('renders read-only permission when viewing someone else’s shared layout', () => {
    useSharedPreviewStore.setState({
      sharedPreview: {
        layout: createTestLayout({ name: 'Shared' }),
        originalName: 'Shared',
        authorName: null,
        cloudShareId: 'share-456',
        permission: 'view',
      },
    });
    const { cleanup } = renderPopover();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('share.anyoneWithLinkCanView')).toBeInTheDocument();
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

describe('SharePopover click outside', () => {
  // A browser runs a microtask checkpoint after each listener of a user click,
  // so React commits the click's state change before the popover's document
  // listener runs. jsdom dispatches in one script task, so flush here instead.
  const commitBeforeDocumentListener = () => {
    flushSync(() => undefined);
  };

  beforeEach(() => {
    resetAllStores();
    vi.mocked(createShare).mockReset();
    document.body.addEventListener('click', commitBeforeDocumentListener);
  });

  afterEach(() => {
    document.body.removeEventListener('click', commitBeforeDocumentListener);
  });

  async function waitForOutsideClickListener() {
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  }

  async function openPopover() {
    render(<ShareButton />);
    act(() => {
      useSharePopoverStore.getState().open();
    });
    await waitForOutsideClickListener();
  }

  async function clickAndSettle(element: HTMLElement) {
    await act(async () => {
      fireEvent.click(element);
      await Promise.resolve();
    });
  }

  it('stays open and shows the refusal when Create share link is refused', async () => {
    vi.mocked(createShare).mockResolvedValue(err(apiContentBlocked(['binLabel'])));
    await openPopover();

    await clickAndSettle(screen.getByText('share.createShareLink'));

    expect(useSharePopoverStore.getState().isOpen).toBe(true);
    expect(screen.getByRole('dialog')).toHaveTextContent('cloudShare.error.blockedBinLabel');
  });

  it('stays open and offers Create share link again after Try again', async () => {
    vi.mocked(createShare).mockResolvedValue(err(apiContentBlocked(['binLabel'])));
    await openPopover();
    await clickAndSettle(screen.getByText('share.createShareLink'));
    act(() => {
      useSharePopoverStore.getState().open();
    });
    await waitForOutsideClickListener();

    await clickAndSettle(screen.getByText('error.tryAgain'));

    expect(useSharePopoverStore.getState().isOpen).toBe(true);
    expect(screen.getByText('share.createShareLink')).toBeInTheDocument();
    expect(screen.queryByText('cloudShare.error.blockedBinLabel')).not.toBeInTheDocument();
  });

  it('stays open and shows the copied link after Create share link succeeds', async () => {
    vi.mocked(createShare).mockResolvedValue(
      ok({
        id: 'share-789',
        url: 'https://example.test/l/share-789',
        deleteToken: 'token-789',
        permission: 'view',
      })
    );
    await openPopover();

    await clickAndSettle(screen.getByText('share.createShareLink'));

    expect(useSharePopoverStore.getState().isOpen).toBe(true);
    expect(screen.getByDisplayValue(/\/l\/share-789\//)).toBeInTheDocument();
    expect(screen.getByText('common.copied')).toBeInTheDocument();
  });

  it('stays open through the delete confirm steps', async () => {
    const { library } = useLibraryStore.getState();
    useLibraryStore.setState({
      library: {
        ...library,
        entries: library.entries.map((entry) => ({
          ...entry,
          cloudShare: {
            id: 'share-123',
            deleteToken: 'token-123',
            sharedAt: 0,
            permission: 'view',
          },
        })),
      },
    });
    await openPopover();

    await clickAndSettle(screen.getByText('share.deleteShareLink'));
    expect(useSharePopoverStore.getState().isOpen).toBe(true);
    expect(screen.getByText('share.deleteConfirmMessage')).toBeInTheDocument();

    await clickAndSettle(screen.getByText('common.cancel'));
    expect(useSharePopoverStore.getState().isOpen).toBe(true);
    expect(screen.getByText('share.deleteShareLink')).toBeInTheDocument();
  });

  it('closes on a click outside the popover and the share button', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    await openPopover();

    await clickAndSettle(outside);

    expect(useSharePopoverStore.getState().isOpen).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    outside.remove();
  });

  it('closes on an outside click whose own handler removes the clicked element', async () => {
    const outside = document.createElement('button');
    outside.addEventListener('click', () => {
      outside.remove();
    });
    document.body.appendChild(outside);
    await openPopover();

    await clickAndSettle(outside);

    expect(useSharePopoverStore.getState().isOpen).toBe(false);
  });
});
