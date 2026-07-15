import { describe, it, expect } from 'vitest';
import { withFontSizeOverride } from './text';

describe('withFontSizeOverride', () => {
  it('sets the override on an absent style', () => {
    expect(withFontSizeOverride(undefined, 6)).toEqual({ fontSizeOverride: 6 });
  });

  it('replaces an existing override, preserving other fields', () => {
    expect(withFontSizeOverride({ font: 'atkinson', fontSizeOverride: 4 }, 9)).toEqual({
      font: 'atkinson',
      fontSizeOverride: 9,
    });
  });

  it('clears the override while keeping other fields', () => {
    expect(withFontSizeOverride({ mode: 'emboss', fontSizeOverride: 5 }, null)).toEqual({
      mode: 'emboss',
    });
  });

  it('returns undefined when clearing leaves an empty style', () => {
    expect(withFontSizeOverride({ fontSizeOverride: 5 }, null)).toBeUndefined();
    expect(withFontSizeOverride(undefined, null)).toBeUndefined();
  });
});
