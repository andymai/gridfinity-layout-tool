import { describe, expect, it } from 'vitest';
import type { ParsedCutoutSpec } from '../panel/CutoutsSection/svgImport/types';
import { specToCutterProfile } from './cutterProfileImport';

const spec = (partial: Partial<ParsedCutoutSpec>): ParsedCutoutSpec => ({
  shape: 'path',
  x: 0,
  y: 0,
  width: 30,
  depth: 50,
  cornerRadius: 0,
  rotation: 0,
  ...partial,
});

const point = (x: number, y: number) => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

describe('specToCutterProfile', () => {
  it('carries a traced path through verbatim', () => {
    const path = [point(0, 0), point(30, 0), point(15, 50)];
    const profile = specToCutterProfile(spec({ shape: 'path', path }));
    expect(profile).toEqual({ shape: 'path', points: path });
  });

  it('rejects paths beyond the schema cap or below two points', () => {
    expect(specToCutterProfile(spec({ shape: 'path', path: [point(0, 0)] }))).toBeNull();
    const huge = Array.from({ length: 2001 }, (_, i) => point(i, 0));
    expect(specToCutterProfile(spec({ shape: 'path', path: huge }))).toBeNull();
  });

  it('maps parametric shapes onto their profile variants', () => {
    expect(specToCutterProfile(spec({ shape: 'circle', width: 12 }))).toEqual({
      shape: 'circle',
      diameter: 12,
    });
    expect(
      specToCutterProfile(spec({ shape: 'rectangle', width: 20, depth: 10, cornerRadius: 2 }))
    ).toEqual({ shape: 'rectangle', width: 20, depth: 10, cornerRadius: 2 });
    expect(specToCutterProfile(spec({ shape: 'slot', width: 40, depth: 4 }))).toEqual({
      shape: 'slot',
      length: 40,
      width: 4,
    });
  });

  it('returns null for unsupported shapes', () => {
    expect(specToCutterProfile(spec({ shape: 'polygon' }))).toBeNull();
    expect(specToCutterProfile(spec({ shape: 'mesh' }))).toBeNull();
  });
});
