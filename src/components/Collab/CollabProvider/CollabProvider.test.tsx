import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollabProvider } from './CollabProvider';
import { resetAllStores } from '@/test/testUtils';

// Mock Liveblocks config
vi.mock('@/liveblocks.config', () => ({
  RoomProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="room-provider">{children}</div>
  ),
  useUpdateMyPresence: vi.fn(() => vi.fn()),
  isLiveblocksConfigured: true,
}));

// Mock contexts
vi.mock('@/shared/contexts', () => ({
  PresenceContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
  LocalMutationsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock hooks
vi.mock('@/hooks/useCollabSync', () => ({
  useCollabSync: vi.fn(),
}));

vi.mock('@/features/cloud-share/hooks/useCloudShareAutoSync', () => ({
  useCloudShareAutoSync: vi.fn(),
}));

// Mock analytics
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

// Mock utilities
vi.mock('@/utils/guestNames', () => ({
  generateGuestName: vi.fn((id: string) => `Guest-${id}`),
  generateGuestColor: vi.fn(() => '#ff0000'),
}));

describe('CollabProvider', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Mock localStorage
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
});
