import { describe, expect, it } from 'vitest';
import { cutoutSvgFileName } from './cutoutSvgFileName';

describe('cutoutSvgFileName', () => {
  it('prefixes with the design name', () => {
    expect(cutoutSvgFileName('Screwdriver Bin')).toBe('Screwdriver Bin-cutouts.svg');
  });

  it('falls back when the name is absent, default, or all-unsafe', () => {
    expect(cutoutSvgFileName()).toBe('gridfinity-cutouts.svg');
    expect(cutoutSvgFileName('   ')).toBe('gridfinity-cutouts.svg');
    expect(cutoutSvgFileName('Untitled Bin')).toBe('gridfinity-cutouts.svg');
    expect(cutoutSvgFileName('///')).toBe('gridfinity-cutouts.svg');
  });

  it('replaces path separators rather than nesting the download', () => {
    expect(cutoutSvgFileName('a/b')).toBe('a_b-cutouts.svg');
  });
});
