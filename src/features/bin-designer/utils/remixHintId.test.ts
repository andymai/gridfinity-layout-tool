import { describe, it, expect } from 'vitest';
import { remixHintId } from './remixHintId';

describe('remixHintId', () => {
  it('keys the dismissal per design', () => {
    expect(remixHintId('abc')).toBe('remix-banner:abc');
    expect(remixHintId('abc')).not.toBe(remixHintId('def'));
  });
});
