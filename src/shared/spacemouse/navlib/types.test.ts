import { describe, expect, it } from 'vitest';
import { commandForId, NAVLIB_COMMANDS } from './types';

describe('commandForId', () => {
  it('resolves every exported command id', () => {
    for (const c of NAVLIB_COMMANDS) {
      expect(commandForId(c.id)).toBe(c.command);
    }
  });

  it("maps the driver's built-in Fit even when unbound", () => {
    expect(commandForId('V3DK_FIT')).toBe('fit');
    expect(commandForId('anything-with-fit-in-it')).toBe('fit');
  });

  it('returns null for unknown ids', () => {
    expect(commandForId('GFLT_UNKNOWN')).toBeNull();
    expect(commandForId('')).toBeNull();
  });
});
