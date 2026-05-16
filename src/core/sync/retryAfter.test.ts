import { describe, it, expect } from 'vitest';
import { parseRetryAfter, rateLimitedBackoffMs } from './retryAfter';

describe('parseRetryAfter', () => {
  it('returns null for missing header', () => {
    expect(parseRetryAfter(null)).toBe(null);
  });

  it('returns null for empty / whitespace', () => {
    expect(parseRetryAfter('')).toBe(null);
    expect(parseRetryAfter('   ')).toBe(null);
  });

  it('parses delta-seconds (integer) into ms', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('1')).toBe(1_000);
  });

  it('rejects non-integer / non-numeric strings that are not parseable as dates', () => {
    expect(parseRetryAfter('thirty')).toBe(null);
    expect(parseRetryAfter('-5')).toBe(null);
  });

  it('parses HTTP-date format', () => {
    const now = Date.parse('2026-05-16T12:00:00.000Z');
    const future = 'Sat, 16 May 2026 12:00:30 GMT';
    expect(parseRetryAfter(future, now)).toBe(30_000);
  });

  it('returns 0 when HTTP-date is in the past', () => {
    const now = Date.parse('2026-05-16T12:00:30.000Z');
    const past = 'Sat, 16 May 2026 12:00:00 GMT';
    expect(parseRetryAfter(past, now)).toBe(0);
  });

  it('caps unreasonably large delta-seconds at 1h', () => {
    expect(parseRetryAfter('999999')).toBe(60 * 60 * 1_000);
  });

  it('caps unreasonably large HTTP-date deltas at 1h', () => {
    const now = Date.parse('2026-05-16T12:00:00.000Z');
    const farFuture = 'Sat, 16 May 2026 23:59:00 GMT';
    expect(parseRetryAfter(farFuture, now)).toBe(60 * 60 * 1_000);
  });
});

describe('rateLimitedBackoffMs', () => {
  it('starts at ~1s for the first attempt', () => {
    expect(rateLimitedBackoffMs(0)).toBeGreaterThanOrEqual(1_000);
    expect(rateLimitedBackoffMs(0)).toBeLessThan(1_200);
  });

  it('doubles per attempt up to the 30s cap', () => {
    expect(rateLimitedBackoffMs(1)).toBeGreaterThanOrEqual(2_000);
    expect(rateLimitedBackoffMs(1)).toBeLessThan(2_200);
    expect(rateLimitedBackoffMs(2)).toBeGreaterThanOrEqual(4_000);
    expect(rateLimitedBackoffMs(3)).toBeGreaterThanOrEqual(8_000);
    expect(rateLimitedBackoffMs(4)).toBeGreaterThanOrEqual(16_000);
  });

  it('caps the base at 30s even for large attempt counts', () => {
    expect(rateLimitedBackoffMs(20)).toBeGreaterThanOrEqual(30_000);
    expect(rateLimitedBackoffMs(20)).toBeLessThan(30_200);
  });

  it('clamps negative attempt counts to 0', () => {
    expect(rateLimitedBackoffMs(-1)).toBeGreaterThanOrEqual(1_000);
    expect(rateLimitedBackoffMs(-1)).toBeLessThan(1_200);
  });
});
