/**
 * Shape checks on the icon catalog that need no geometry kernel, so a
 * malformed contributed path fails fast in the unit suite rather than deep in
 * a worker boolean. Rendered geometry is verified in
 * `features/generation/worker/generators/labelPlateIcons.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { LABEL_ICON_PATHS } from './labelIconPaths';
import { LABEL_PLATE_ICONS } from './labelPlates';

const allSubpaths = (): { id: string; label: string; d: string }[] =>
  LABEL_PLATE_ICONS.flatMap((id) => {
    const def = LABEL_ICON_PATHS[id];
    return [
      { id, label: `${id} outline`, d: def.outline },
      ...(def.holes ?? []).map((d, i) => ({ id, label: `${id} hole ${i}`, d })),
    ];
  });

describe('LABEL_ICON_PATHS', () => {
  it('covers exactly the allowlisted ids', () => {
    expect(Object.keys(LABEL_ICON_PATHS).sort()).toEqual([...LABEL_PLATE_ICONS].sort());
  });

  it('gives every subpath a closed, absolute path', () => {
    for (const { label, d } of allSubpaths()) {
      expect(d.trim(), label).not.toBe('');
      expect(d.trimStart().startsWith('M'), `${label} must open with an absolute moveto`).toBe(
        true
      );
      expect(d.trimEnd().endsWith('Z'), `${label} must be explicitly closed`).toBe(true);
    }
  });

  it('keeps each subpath to a single contour', () => {
    // Holes are cut explicitly; extra subpaths inside one `d` would be
    // flattened into a single Blueprint whose containment brepjs infers
    // inconsistently (arc loops union regardless of winding).
    for (const { label, d } of allSubpaths()) {
      expect(d.match(/M/gi)?.length ?? 0, `${label} must contain exactly one subpath`).toBe(1);
    }
  });

  // Only the command letters — a blanket /[a-z]/ would also reject exponent
  // notation like 1e-3, which SVG permits and plenty of editors emit.
  it('uses absolute path commands only', () => {
    for (const { label, d } of allSubpaths()) {
      expect(d, `${label} must not use relative commands`).not.toMatch(/[mlhvcsqtaz]/);
    }
  });

  it('declares holes only where the outline can contain them', () => {
    for (const id of LABEL_PLATE_ICONS) {
      const holes = LABEL_ICON_PATHS[id].holes ?? [];
      expect(Array.isArray(holes), id).toBe(true);
      for (const hole of holes) expect(hole, `${id} hole`).not.toBe(LABEL_ICON_PATHS[id].outline);
    }
  });
});
