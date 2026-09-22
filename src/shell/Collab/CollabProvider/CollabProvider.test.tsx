import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollabProvider } from './CollabProvider';
import { resetAllStores } from '@/test/testUtils';
import { useLibraryStore } from '@/core/store/library';
import { useCloudShareAutoSync } from '@/features/cloud-share/hooks/useCloudShareAutoSync';
import { layoutId } from '@/core/types';
import type { LayoutEntry } from '@/core/types';

vi.mock('@/liveblocks.config', () => ({
  RoomProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="room-provider">{children}</div>
  ),
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

describe('CollabProvider', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    const localStorageMock = {
      getItem: vi.fn(() => 'test-user-id'),
      setItem: vi.fn(),
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
  });
});
