import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shouldSkipPrefetch } from './prefetchPolicy';

function setConnection(value: unknown): void {
  Object.defineProperty(navigator, 'connection', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('shouldSkipPrefetch', () => {
  let original: unknown;

  beforeEach(() => {
    original = (navigator as unknown as Record<string, unknown>).connection;
  });

  afterEach(() => {
    setConnection(original);
  });

  // Absent in Safari and Firefox, which are not thereby data-saver users.
  it('does not skip when the Network Information API is unavailable', () => {
    setConnection(undefined);
    expect(shouldSkipPrefetch()).toBe(false);
  });

  it('skips under data-saver', () => {
    setConnection({ saveData: true, effectiveType: '4g' });
    expect(shouldSkipPrefetch()).toBe(true);
  });

  it.each(['2g', 'slow-2g'])('skips on %s', (effectiveType) => {
    setConnection({ saveData: false, effectiveType });
    expect(shouldSkipPrefetch()).toBe(true);
  });

  it.each(['3g', '4g'])('does not skip on %s', (effectiveType) => {
    setConnection({ saveData: false, effectiveType });
    expect(shouldSkipPrefetch()).toBe(false);
  });
});
