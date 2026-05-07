import { describe, it, expect } from 'vitest';
import { deriveUserId } from './userId';

describe('deriveUserId', () => {
  it('returns a 32-char lowercase hex string', () => {
    const uid = deriveUserId('google', '1234567890');
    expect(uid).toMatch(/^[a-f0-9]{32}$/);
  });

  it('is stable for the same input', () => {
    expect(deriveUserId('google', 'abc')).toBe(deriveUserId('google', 'abc'));
  });

  it('differs across providers for the same subject', () => {
    expect(deriveUserId('google', 'shared-id')).not.toBe(deriveUserId('github', 'shared-id'));
  });

  it('differs across subjects for the same provider', () => {
    expect(deriveUserId('google', 'a')).not.toBe(deriveUserId('google', 'b'));
  });
});
