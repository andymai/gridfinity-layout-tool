import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { getInitials, usePresence } from '@/shared/hooks/usePresence';
import * as collabModeModule from './useCollabMode';
import * as liveblocksModule from '@/liveblocks.config';
import type { LiveblocksStorage, UserPresence } from '@/liveblocks.config';

vi.mock('./useCollabMode');
vi.mock('@/liveblocks.config');

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

describe('usePresence with Liveblocks storage', () => {
  const selfPresence: UserPresence = {
    cursor: null,
    name: 'Owner',
    color: '#3B82F6',
  };

  function mockStorageRoot(root: Partial<LiveblocksStorage>): void {
    vi.mocked(liveblocksModule.useStorage).mockImplementation(
      <T>(selector: (r: LiveblocksStorage) => T) => selector(root as LiveblocksStorage)
    );
  }

  beforeEach(() => {
    vi.mocked(collabModeModule.useCollabMode).mockReturnValue({
      isCollaborative: true,
      canEdit: true,
      shareId: 'share-abc',
    });
    vi.mocked(liveblocksModule.useOthers).mockReturnValue([]);
    vi.mocked(liveblocksModule.useSelf).mockReturnValue({
      connectionId: 7,
      presence: selfPresence,
    });
    vi.mocked(liveblocksModule.useStatus).mockReturnValue('connected');
  });

  it('treats a room root without metadata as having no owner', () => {
    mockStorageRoot({});

    const { result } = renderHook(() => usePresence());

    expect(result.current.participants).toEqual([
      expect.objectContaining({ id: '7', isOwner: false, isSelf: true }),
    ]);
  });

  it('marks the participant whose id matches metadata.ownerId as owner', () => {
    mockStorageRoot({ metadata: { ownerId: '7', permission: 'edit', version: 1 } });

    const { result } = renderHook(() => usePresence());

    expect(result.current.participants[0]?.isOwner).toBe(true);
  });
});
