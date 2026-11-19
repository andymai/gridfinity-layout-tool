import { describe, it, expect } from 'vitest';
import { isoStampAfter, stampAfter } from './editStamp';

describe('stampAfter', () => {
  it('is the time now when the previous stamp is older', () => {
    expect(stampAfter(1_000, 5_000)).toBe(5_000);
  });

  it('is 1 ms after a previous stamp that is ahead of this clock', () => {
    expect(stampAfter(9_000, 5_000)).toBe(9_001);
    expect(stampAfter(5_000, 5_000)).toBe(5_001);
  });

  it('is the time now with no usable previous stamp', () => {
    expect(stampAfter(undefined, 5_000)).toBe(5_000);
    expect(stampAfter(Number.NaN, 5_000)).toBe(5_000);
  });
});

describe('isoStampAfter', () => {
  it('orders an ISO stamp the same way', () => {
    const ahead = '2026-11-17T04:46:11.000Z';
    expect(isoStampAfter(ahead, Date.parse('2026-11-16T23:47:04.000Z'))).toBe(
      '2026-11-17T04:46:11.001Z'
    );
    expect(isoStampAfter('2026-11-16T00:00:00.000Z', Date.parse(ahead))).toBe(ahead);
    expect(isoStampAfter(undefined, Date.parse(ahead))).toBe(ahead);
    expect(isoStampAfter('not a date', Date.parse(ahead))).toBe(ahead);
  });
});
