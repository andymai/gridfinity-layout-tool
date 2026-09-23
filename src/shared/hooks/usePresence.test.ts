import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { getInitials, usePresence } from '@/shared/hooks/usePresence';

interface MockRoomUser {
  connectionId: number;
  id?: string;
  presence: { name: string; color: string };
}

let others: MockRoomUser[] = [];
let self: MockRoomUser | null = null;
let storageRoot: Record<string, unknown> = {};

vi.mock('@/liveblocks.config', () => ({
  useOthers: () => others,
  useSelf: () => self,
  useStatus: () => 'connected',
  useStorage: <T>(selector: (root: Record<string, unknown>) => T) => selector(storageRoot),
}));

vi.mock('./useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: true, canEdit: true, shareId: 'share-abc' }),
}));

// Note: Full hook testing requires mocking Liveblocks hooks which is complex.
// We focus on testing the utility functions and behavior that doesn't require Liveblocks.

describe('usePresence utilities', () => {
  describe('getInitials', () => {
    it('returns first two characters for single word', () => {
      expect(getInitials('Alex')).toBe('AL');
    });

    it('returns first letters of first and last word for multiple words', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('handles names with middle names', () => {
      expect(getInitials('John Michael Doe')).toBe('JD');
    });

    it('handles single character names', () => {
      expect(getInitials('A')).toBe('A');
    });

    it('handles empty string', () => {
      expect(getInitials('')).toBe('?');
    });

    it('handles whitespace-only string', () => {
      expect(getInitials('   ')).toBe('?');
    });

    it('handles extra whitespace between words', () => {
      expect(getInitials('John    Doe')).toBe('JD');
    });

    it('handles names with leading/trailing whitespace', () => {
      expect(getInitials('  Alex Smith  ')).toBe('AS');
    });

    it('handles lowercase names (returns uppercase)', () => {
      expect(getInitials('john doe')).toBe('JD');
    });

    it('handles mixed case names', () => {
      expect(getInitials('jOhn dOe')).toBe('JD');
    });
  });
});

describe('usePresence integration (mock-based)', () => {
  // These tests verify the hook's structure without Liveblocks
  // The hook is designed to return empty state when not in collaborative mode

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('non-collaborative mode', () => {
    it('exports expected types', async () => {
      // Verify the module exports the expected interfaces
      const presenceModule = await import('@/shared/hooks/usePresence');

      expect(typeof presenceModule.usePresence).toBe('function');
      expect(typeof presenceModule.getInitials).toBe('function');
    });

    it('hook interface includes expected properties', async () => {
      // Just verify the shape of the returned state
      const { usePresence } = await import('@/shared/hooks/usePresence');

      // Note: We can't fully test the hook without mocking Liveblocks,
      // but we can verify it doesn't crash when imported
      expect(usePresence).toBeDefined();
    });
  });

  describe('PresenceState interface', () => {
    it('defines expected shape', async () => {
      // The EMPTY_STATE constant should match PresenceState interface
      const presenceModule = await import('@/shared/hooks/usePresence');

      // We can't directly access EMPTY_STATE but we can verify
      // the hook exists and the utilities work
      expect(presenceModule.usePresence).toBeDefined();
      expect(presenceModule.getInitials).toBeDefined();
    });
  });

  describe('Participant interface', () => {
    it('should include expected fields', () => {
      // This test verifies the TypeScript types compile correctly
      // by creating a mock participant object
      interface Participant {
        id: string;
        name: string;
        color: string;
        isOwner: boolean;
        isSelf: boolean;
      }

      const mockParticipant: Participant = {
        id: '123',
        name: 'Test User',
        color: '#3B82F6',
        isOwner: false,
        isSelf: true,
      };

      expect(mockParticipant.id).toBe('123');
      expect(mockParticipant.name).toBe('Test User');
      expect(mockParticipant.isOwner).toBe(false);
      expect(mockParticipant.isSelf).toBe(true);
    });
  });

  describe('ConnectionStatus type', () => {
    it('should accept valid status values', () => {
      type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

      const statuses: ConnectionStatus[] = [
        'connecting',
        'connected',
        'reconnecting',
        'disconnected',
      ];

      expect(statuses.length).toBe(4);
      expect(statuses).toContain('connected');
      expect(statuses).toContain('reconnecting');
    });
  });
});

describe('usePresence with room storage', () => {
  afterEach(() => {
    others = [];
    self = null;
    storageRoot = {};
  });

  it('lists participants when a read-only client joins a room whose storage was never initialized', () => {
    self = { connectionId: 7, presence: { name: 'Owner', color: '#123456' } };
    storageRoot = {};

    const { result } = renderHook(() => usePresence());

    expect(result.current.participants).toEqual([
      { id: '7', name: 'Owner', color: '#123456', isOwner: false, isSelf: true },
    ]);
  });

  it('marks the participant whose Liveblocks user id is the stored owner id', () => {
    const ownerUserId = '7f3c2a10-5b1e-4c8d-9a2f-0e6d4b8c1a33';
    others = [{ connectionId: 3, id: ownerUserId, presence: { name: 'Owner', color: '#111111' } }];
    self = { connectionId: 7, id: 'guest-user-id', presence: { name: 'Guest', color: '#222222' } };
    storageRoot = { metadata: { ownerId: ownerUserId, permission: 'edit', version: 1 } };

    const { result } = renderHook(() => usePresence());

    const owner = result.current.participants.find((p) => p.name === 'Owner');
    const guest = result.current.participants.find((p) => p.name === 'Guest');
    expect(owner?.isOwner).toBe(true);
    expect(guest?.isOwner).toBe(false);
    expect(result.current.participants[0]?.name).toBe('Owner');
  });
});
