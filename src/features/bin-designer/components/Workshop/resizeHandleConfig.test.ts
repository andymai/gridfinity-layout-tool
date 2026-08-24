import { describe, expect, it } from 'vitest';
import { createAssemblyPartNode, DEFAULT_PART_TRANSFORM } from '@/shared/items/assembly/descriptor';
import type { AssemblyPartNode, AssemblyPartType } from '@/shared/types/assembly';
import { partFootprint, partSeatHeight } from '@/shared/types/assemblyPlacement';
import { resizeHandlesFor } from './resizeHandleConfig';

const ALL_TYPES: AssemblyPartType[] = [
  'post',
  'fin',
  'block',
  'tube',
  'cradle',
  'hook',
  'arch',
  'comb',
  'riser',
  'boreBank',
  'cutter',
];

function make(type: AssemblyPartType): AssemblyPartNode {
  return createAssemblyPartNode(type, `node-${type}`, { ...DEFAULT_PART_TRANSFORM });
}

describe('resizeHandlesFor', () => {
  it('offers at least one handle for every part type at defaults', () => {
    for (const type of ALL_TYPES) {
      expect(resizeHandlesFor(make(type)).length, type).toBeGreaterThan(0);
    }
  });

  it('round-trips offset → param for every handle at defaults', () => {
    for (const type of ALL_TYPES) {
      const node = make(type);
      for (const def of resizeHandlesFor(node)) {
        const offset = def.offset(node);
        expect(def.fromOffset(offset, node), `${type}.${def.key}`).toBeCloseTo(def.read(node));
      }
    }
  });

  it('keeps every current default value inside the handle range', () => {
    for (const type of ALL_TYPES) {
      const node = make(type);
      for (const def of resizeHandlesFor(node)) {
        const value = def.read(node);
        expect(value, `${type}.${def.key}`).toBeGreaterThanOrEqual(def.min);
        expect(value, `${type}.${def.key}`).toBeLessThanOrEqual(def.max);
      }
    }
  });

  it('x/y handle offsets sit on the footprint edge', () => {
    for (const type of ALL_TYPES) {
      const node = make(type);
      const footprint = partFootprint(node);
      for (const def of resizeHandlesFor(node)) {
        if (def.axis === 'z') continue;
        const expected = (def.axis === 'x' ? footprint.w : footprint.d) / 2;
        expect(def.offset(node), `${type}.${def.key}`).toBeCloseTo(expected);
      }
    }
  });

  it('z handle offsets sit on the part top', () => {
    for (const type of ALL_TYPES) {
      const node = make(type);
      for (const def of resizeHandlesFor(node)) {
        if (def.axis !== 'z') continue;
        // Hook tops out at max(stem, stem - thickness + lip); the handle
        // drives the stem itself, so it may sit below the true top.
        if (node.type === 'hook') continue;
        expect(def.offset(node), `${type}.${def.key}`).toBeCloseTo(partSeatHeight(node));
      }
    }
  });

  it('derived footprints invert through their extra terms', () => {
    const tube = make('tube');
    if (tube.type !== 'tube') throw new Error('unreachable');
    const tubeHandle = resizeHandlesFor(tube).find((d) => d.key === 'boreDiameter');
    if (!tubeHandle) throw new Error('unreachable');
    // Dragging the outer edge out by 5mm grows the bore by 10mm, wall fixed.
    const grown = tubeHandle.fromOffset(tubeHandle.offset(tube) + 5, tube);
    expect(grown).toBeCloseTo(tube.params.boreDiameter + 10);

    const arch = make('arch');
    if (arch.type !== 'arch') throw new Error('unreachable');
    const spanHandle = resizeHandlesFor(arch).find((d) => d.key === 'span');
    if (!spanHandle) throw new Error('unreachable');
    const grownSpan = spanHandle.fromOffset(spanHandle.offset(arch) + 5, arch);
    expect(grownSpan).toBeCloseTo(arch.params.span + 10);
  });

  it('riser handles scale by step count', () => {
    const riser = make('riser');
    if (riser.type !== 'riser') throw new Error('unreachable');
    const byKey = new Map(resizeHandlesFor(riser).map((d) => [d.key, d]));
    const depth = byKey.get('stepDepth');
    const height = byKey.get('stepHeight');
    if (!depth || !height) throw new Error('unreachable');
    expect(depth.fromOffset(depth.offset(riser) + riser.params.stepCount, riser)).toBeCloseTo(
      riser.params.stepDepth + 2
    );
    expect(height.fromOffset(height.offset(riser) + riser.params.stepCount, riser)).toBeCloseTo(
      riser.params.stepHeight + 1
    );
  });

  it('cutter handles follow the profile shape', () => {
    const cutter = make('cutter');
    expect(resizeHandlesFor(cutter).map((d) => d.key)).toEqual(['profile.diameter']);
    if (cutter.type !== 'cutter') throw new Error('unreachable');
    const slot: AssemblyPartNode = {
      ...cutter,
      params: {
        ...cutter.params,
        profile: { shape: 'slot', length: 40, width: 10 },
      },
    };
    expect(resizeHandlesFor(slot).map((d) => d.key)).toEqual(['profile.length', 'profile.width']);
    const outline: AssemblyPartNode = {
      ...cutter,
      params: {
        ...cutter.params,
        profile: {
          shape: 'outline',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
        },
      },
    };
    expect(resizeHandlesFor(outline)).toEqual([]);
  });

  it('applies a value through the param patch', () => {
    const block = make('block');
    const widthHandle = resizeHandlesFor(block).find((d) => d.key === 'width');
    if (!widthHandle) throw new Error('unreachable');
    expect(widthHandle.apply(120, block)).toEqual({ width: 120 });

    const cutter = make('cutter');
    const diameterHandle = resizeHandlesFor(cutter).find((d) => d.key === 'profile.diameter');
    if (!diameterHandle || cutter.type !== 'cutter') throw new Error('unreachable');
    const patch = diameterHandle.apply(25, cutter);
    expect('profile' in patch && patch.profile).toMatchObject({ diameter: 25 });
  });
});
