import { describe, it, expect } from 'vitest';
import { withExactLabelSize, withFontSizeOverride } from './text';

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

describe('withExactLabelSize', () => {
  it('pins the fixed mode and size', () => {
    expect(withExactLabelSize(undefined, 8)).toEqual({ sizeMode: 'fixed', fixedSize: 8 });
  });

  it('drops a legacy ceiling when setting, keeping other fields', () => {
    expect(withExactLabelSize({ font: 'atkinson', fontSizeOverride: 4 }, 9)).toEqual({
      font: 'atkinson',
      sizeMode: 'fixed',
      fixedSize: 9,
    });
  });

  it('clears size fields and the ceiling together, preserving the rest', () => {
    expect(withExactLabelSize({ font: 'atkinson', sizeMode: 'fixed', fixedSize: 9 }, null)).toEqual(
      { font: 'atkinson' }
    );
  });

  it('collapses to undefined when clearing leaves nothing', () => {
    expect(withExactLabelSize({ sizeMode: 'fixed', fixedSize: 9, fontSizeOverride: 4 }, null)).toBe(
      undefined
    );
  });
});
