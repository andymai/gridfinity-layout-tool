import { describe, expect, it } from 'vitest';
import en from './en';

describe('en strings', () => {
  it('holds characters, not escape sequences the UI would print verbatim', () => {
    const escaped = Object.entries(en)
      .filter(([, value]) => /\\u[0-9a-fA-F]{4}|\\n/.test(value))
      .map(([key]) => key);
    expect(escaped).toEqual([]);
  });
});
