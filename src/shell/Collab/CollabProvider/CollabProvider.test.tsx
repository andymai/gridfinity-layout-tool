import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { CollabProvider } from './CollabProvider';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { useLibraryStore } from '@/core/store/library';
import { useLayoutStore } from '@/core/store/layout';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useCloudShareAutoSync } from '@/features/cloud-share/hooks/useCloudShareAutoSync';
import { recordOwnCopyRevision } from '@/features/cloud-share/utils';
import { useCollabSync } from '@/shared/hooks/useCollabSync';
import { stampFor } from '@/shared/utils/roomLinkStamp';
import { binId, layoutId } from '@/core/types';
import type { LayoutEntry } from '@/core/types';
import type { LiveblocksStorage } from '@/liveblocks.config';

const room = vi.hoisted(() => ({
  enteredId: '',
  contextId: null as string | null,
  initialStorage: [] as unknown[],
}));

vi.mock('@/liveblocks.config', () => ({
  RoomProvider: ({
    id,
    initialStorage,
    children,
  }: {
    id: string;
    initialStorage: unknown;
    children: React.ReactNode;
  }) => {
    room.enteredId = id;
    room.initialStorage.push(initialStorage);
    return <div data-testid="room-provider">{children}</div>;
  },
  useRoom: () => ({ id: room.contextId ?? room.enteredId }),
  useUpdateMyPresence: vi.fn(() => vi.fn()),
  isLiveblocksConfigured: true,
}));

vi.mock('@/shared/contexts', () => ({
  PresenceContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
  LocalMutationsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/hooks/useCollabSync', () => ({
  useCollabSync: vi.fn(),
}));

vi.mock('@/features/cloud-share/hooks/useCloudShareAutoSync', () => ({
  useCloudShareAutoSync: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

// Mock utilities
vi.mock('@/shared/utils/guestNames', () => ({
  generateGuestName: vi.fn((id: string) => `Guest-${id}`),
  generateGuestColor: vi.fn(() => '#ff0000'),
}));

function lastInitialStorage(): LiveblocksStorage {
  return room.initialStorage[room.initialStorage.length - 1] as LiveblocksStorage;
}

describe('CollabProvider', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    room.enteredId = '';
    room.contextId = null;
    room.initialStorage = [];

    const stored = new Map<string, string>([['gridfinity-user-id', 'test-user-id']]);
    const localStorageMock = {
      getItem: vi.fn((key: string) => stored.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        stored.set(key, value);
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  it('renders without crashing', () => {
    render(
      <CollabProvider shareId="test-share-id">
        <div data-testid="child">Test Child</div>
      </CollabProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders children inside RoomProvider', () => {
    render(
      <CollabProvider shareId="test-share-id">
        <div data-testid="child">Test Child</div>
      </CollabProvider>
    );
    expect(screen.getByTestId('room-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders with custom share ID', () => {
    render(
      <CollabProvider shareId="custom-share-id">
        <div data-testid="child">Test Child</div>
      </CollabProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  describe('owner delete token', () => {
    beforeEach(() => {
      const { library } = useLibraryStore.getState();
      const healed: LayoutEntry = {
        id: layoutId('staleLayout1'),
        name: 'Healed',
        createdAt: 0,
        modifiedAt: 0,
        preview: { drawerWidth: 1, drawerDepth: 1, drawerHeight: 1, binCount: 0, layerCount: 1 },
        cloudShare: {
          id: 'freshShare01',
          deleteToken: 'fresh-token',
          sharedAt: 0,
          permission: 'edit',
        },
      } as LayoutEntry;
      useLibraryStore.setState({ library: { ...library, entries: [healed] } });
    });

    it("hands the owner's token to the room of the share it belongs to", () => {
      render(
        <CollabProvider shareId="freshShare01">
          <div />
        </CollabProvider>
      );
      expect(useCloudShareAutoSync).toHaveBeenLastCalledWith('freshShare01', 'fresh-token');
    });

    it("never hands a re-shared layout's new token to its old share's room", () => {
      render(
        <CollabProvider shareId="staleLayout1">
          <div />
        </CollabProvider>
      );
      expect(useCloudShareAutoSync).toHaveBeenLastCalledWith('staleLayout1', undefined);
    });

    it("does not lend another tab's later save of a different layout to this tab's copy", () => {
      const savedByOtherTab = createTestLayout({
        bins: [createTestBin({ id: binId('other-tab') })],
      });
      recordOwnCopyRevision('freshShare01', '2026-11-01T10:00:00.000Z', savedByOtherTab);
      useLayoutStore.setState({
        layout: createTestLayout({ bins: [createTestBin({ id: binId('this-tab') })] }),
      });

      render(
        <CollabProvider shareId="freshShare01">
          <div />
        </CollabProvider>
      );

      expect(lastInitialStorage().metadata.linkUpdatedAt).toBeUndefined();
    });

    it("joins with the link revision of the owner's last save of its copy", () => {
      const layout = createTestLayout({ bins: [createTestBin({ id: binId('owned') })] });
      recordOwnCopyRevision('freshShare01', '2026-11-01T10:00:00.000Z', layout);
      useLayoutStore.setState({ layout });

      render(
        <CollabProvider shareId="freshShare01">
          <div />
        </CollabProvider>
      );

      expect(useCollabSync).toHaveBeenLastCalledWith(stampFor(layout, '2026-11-01T10:00:00.000Z'));
      expect(lastInitialStorage().metadata).toMatchObject({
        version: 2,
        ...stampFor(layout, '2026-11-01T10:00:00.000Z'),
      });
    });

    it('lends no revision from a record that names no layout', () => {
      localStorage.setItem(
        'gridfinity-owned-share-revisions',
        JSON.stringify({ freshShare01: '2026-11-01T10:00:00.000Z' })
      );
      useLayoutStore.setState({
        layout: createTestLayout({ bins: [createTestBin({ id: binId('owned') })] }),
      });

      render(
        <CollabProvider shareId="freshShare01">
          <div />
        </CollabProvider>
      );

      expect(useCollabSync).toHaveBeenLastCalledWith({ linkUpdatedAt: '2026-11-01T10:00:00.000Z' });
      expect(lastInitialStorage().metadata.linkUpdatedAt).toBeUndefined();
    });
  });

  describe('a visitor joining from a share link', () => {
    const fetched = createTestLayout({ bins: [createTestBin({ id: binId('fetched') })] });

    beforeEach(() => {
      useLayoutStore.setState({ layout: fetched });
      useSharedPreviewStore
        .getState()
        .setSharedLayoutPreview(
          fetched,
          'Shared',
          undefined,
          'visitShare01',
          'edit',
          '2026-11-01T10:00:00.000Z'
        );
    });

    it('joins with the link revision of the copy it fetched', () => {
      render(
        <CollabProvider shareId="visitShare01">
          <div />
        </CollabProvider>
      );

      expect(useCollabSync).toHaveBeenLastCalledWith(stampFor(fetched, '2026-11-01T10:00:00.000Z'));
      expect(useCloudShareAutoSync).toHaveBeenLastCalledWith('visitShare01', undefined);
      expect(lastInitialStorage().metadata).toMatchObject(
        stampFor(fetched, '2026-11-01T10:00:00.000Z')
      );
    });

    it('takes no revision from a copy fetched for another share', () => {
      render(
        <CollabProvider shareId="otherShare01">
          <div />
        </CollabProvider>
      );

      expect(useCollabSync).toHaveBeenLastCalledWith(undefined);
      expect(lastInitialStorage().metadata.linkUpdatedAt).toBeUndefined();
    });
  });

  describe('switching shares', () => {
    it('does not sync while the room context is still the previous room', () => {
      room.contextId = 'gridfinity-previousShare';

      render(
        <CollabProvider shareId="nextShare01">
          <div />
        </CollabProvider>
      );

      expect(useCollabSync).not.toHaveBeenCalled();
      expect(useCloudShareAutoSync).not.toHaveBeenCalled();
    });

    it('seeds the next room with the layout it opens, and starts its sync afresh', () => {
      const syncInstances = new Set<symbol>();
      vi.mocked(useCollabSync).mockImplementation(() => {
        syncInstances.add(useRef(Symbol('sync')).current);
      });
      const first = createTestLayout({ name: 'First' });
      useLayoutStore.setState({ layout: first });
      const { rerender } = render(
        <CollabProvider shareId="firstShare01">
          <div />
        </CollabProvider>
      );

      const second = createTestLayout({ name: 'Second' });
      useLayoutStore.setState({ layout: second });
      rerender(
        <CollabProvider shareId="secondShare1">
          <div />
        </CollabProvider>
      );

      expect(room.enteredId).toBe('gridfinity-secondShare1');
      expect(lastInitialStorage().layout).toBe(second);
      expect(syncInstances.size).toBe(2);
    });
  });
});
