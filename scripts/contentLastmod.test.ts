import { describe, expect, it } from 'vitest';
import { resolvePageLastmod } from './contentLastmod';

const FALLBACK = '2026-10-15';

describe('resolvePageLastmod', () => {
  it("uses the page's own date for both the sitemap and dateModified", () => {
    expect(resolvePageLastmod('2026-08-09', FALLBACK)).toEqual({
      own: '2026-08-09',
      sitemap: '2026-08-09',
      invalid: false,
    });
  });

  it('falls back silently when the page has no lastmod', () => {
    expect(resolvePageLastmod(undefined, FALLBACK)).toEqual({
      own: undefined,
      sitemap: FALLBACK,
      invalid: false,
    });
  });

  it('accepts a leap day only in a leap year', () => {
    expect(resolvePageLastmod('2024-02-29', FALLBACK).own).toBe('2024-02-29');
    expect(resolvePageLastmod('2025-02-29', FALLBACK).invalid).toBe(true);
  });

  it.each<[string, unknown]>([
    ['an impossible day that Date would roll over', '2026-02-30'],
    ['an out-of-range month', '2026-13-01'],
    ['a date without zero padding', '2026-8-9'],
    ['a full timestamp', '2026-08-09T12:00:00Z'],
    ['free text', 'August 9, 2026'],
    ['an empty string', ''],
    ['null from an empty YAML key', null],
    ['a number', 20260809],
    ['a Date object', new Date('2026-08-09T00:00:00Z')],
  ])('flags %s and falls back', (_label, value) => {
    expect(resolvePageLastmod(value, FALLBACK)).toEqual({
      own: undefined,
      sitemap: FALLBACK,
      invalid: true,
    });
  });
});
