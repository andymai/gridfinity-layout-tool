import { describe, it, expect, beforeEach } from 'vitest';
import { capturePrevious, resetVersionCounters } from './shared';

describe('shared handler utilities', () => {
  beforeEach(() => {
    resetVersionCounters();
  });

  describe('capturePrevious', () => {
    it('captures previous values for updated keys', () => {
      const existing = { name: 'Old', color: '#fff', height: 5 };
      const updates = { name: 'New', color: '#000' };
      const previous = capturePrevious(existing, updates);
      expect(previous).toEqual({ name: 'Old', color: '#fff' });
    });

    it('does not capture keys not in updates', () => {
      const existing = { name: 'Old', color: '#fff', height: 5 };
      const updates = { name: 'New' };
      const previous = capturePrevious(existing, updates);
      expect(previous).toEqual({ name: 'Old' });
      expect('color' in previous).toBe(false);
      expect('height' in previous).toBe(false);
    });

    it('handles empty updates', () => {
      const existing = { name: 'Old' };
      const previous = capturePrevious(existing, {});
      expect(previous).toEqual({});
    });

    it('captures undefined values if key exists in entity', () => {
      const existing = { name: 'Old', optional: undefined } as { name: string; optional?: string };
      const updates = { optional: 'now set' };
      const previous = capturePrevious(existing, updates);
      expect(previous).toEqual({ optional: undefined });
    });
  });

  describe('resetVersionCounters', () => {
    it('resets without error', () => {
      expect(() => resetVersionCounters()).not.toThrow();
    });
  });
});
