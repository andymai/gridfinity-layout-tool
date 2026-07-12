import { describe, expect, it } from 'vitest';
import { gridUnits, heightUnits } from '@/core/types';
import type { Drawer } from '@/core/types';
import { validateOutline } from '@/shared/utils/drawerOutline';
import { outlineSignedArea } from '@/shared/utils/drawerOutlineGeometry';
import { cornersToOutline, maxCutExtentMm, NO_CUTS } from './cornersToOutline';

const U = 42;

function drawer(width: number, depth: number): Drawer {
  return { width: gridUnits(width), depth: gridUnits(depth), height: heightUnits(6) };
}

describe('cornersToOutline', () => {
  it('returns null when every corner is none (plain rectangle)', () => {
    expect(cornersToOutline(drawer(4, 4), NO_CUTS, U)).toBeNull();
  });

  it('emits a valid chamfered outline with the exact cut area', () => {
    const outline = cornersToOutline(
      drawer(4, 4),
      { ...NO_CUTS, tr: { kind: 'chamfer', size: 30 } },
      U
    );
    expect(outline).not.toBeNull();
    if (outline === null) return;
    expect(validateOutline(outline, 4 * U, 4 * U, U)).toBeNull();
    // Rectangle minus the 30mm right-triangle.
    expect(outlineSignedArea(outline)).toBeCloseTo(4 * U * 4 * U - (30 * 30) / 2);
    expect(outline.authoring?.kind).toBe('corners');
    expect(outline.authoring?.corners?.tr).toEqual({ kind: 'chamfer', size: 30 });
  });

  it('emits a quarter-circle arc for radius cuts', () => {
    const outline = cornersToOutline(
      drawer(4, 4),
      { ...NO_CUTS, bl: { kind: 'radius', r: 21 } },
      U
    );
    expect(outline).not.toBeNull();
    if (outline === null) return;
    expect(validateOutline(outline, 4 * U, 4 * U, U)).toBeNull();
    const arcVertex = outline.vertices.find((v) => (v.bulge ?? 0) !== 0);
    expect(arcVertex).toEqual({ x: 0, y: 21, bulge: Math.tan(Math.PI / 8) });
    // Rectangle minus the corner square + the quarter disc. The measured area
    // uses the flattened polyline (≤0.05mm chord error), so allow ~1mm² slack.
    const cutArea = 21 * 21 - (Math.PI * 21 * 21) / 4;
    expect(Math.abs(outlineSignedArea(outline) - (4 * U * 4 * U - cutArea))).toBeLessThan(2);
  });

  it('emits a rectangular bite for notch cuts', () => {
    const outline = cornersToOutline(
      drawer(4, 4),
      { ...NO_CUTS, br: { kind: 'notch', w: 42, d: 84 } },
      U
    );
    expect(outline).not.toBeNull();
    if (outline === null) return;
    expect(validateOutline(outline, 4 * U, 4 * U, U)).toBeNull();
    expect(outlineSignedArea(outline)).toBeCloseTo(4 * U * 4 * U - 42 * 84);
    const keys = outline.vertices.map((v) => `${v.x},${v.y}`);
    expect(keys).toContain(`${4 * U - 42},84`);
  });

  it('composes cuts on all four corners into one valid loop', () => {
    const outline = cornersToOutline(
      drawer(6, 4),
      {
        tl: { kind: 'chamfer', size: 20 },
        tr: { kind: 'radius', r: 25 },
        bl: { kind: 'notch', w: 30, d: 40 },
        br: { kind: 'chamfer', size: 15 },
      },
      U
    );
    expect(outline).not.toBeNull();
    if (outline === null) return;
    expect(validateOutline(outline, 6 * U, 4 * U, U)).toBeNull();
    // 1 (bl notch: 3) + 2 (br) + 2 (tr) + 2 (tl) = 9 vertices.
    expect(outline.vertices).toHaveLength(9);
  });

  it('maxCutExtentMm keeps same-edge cuts from meeting', () => {
    const max = maxCutExtentMm(drawer(4, 6), U);
    expect(max).toBe(Math.floor((4 * U) / 2 - 1));
    const outline = cornersToOutline(
      drawer(4, 6),
      {
        ...NO_CUTS,
        bl: { kind: 'chamfer', size: max },
        br: { kind: 'chamfer', size: max },
      },
      U
    );
    expect(outline).not.toBeNull();
    if (outline === null) return;
    expect(validateOutline(outline, 4 * U, 6 * U, U)).toBeNull();
  });
});
