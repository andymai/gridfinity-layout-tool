/**
 * Cross-boundary equality tests for the Workshop assembly mirror.
 *
 * `api/lib/assemblyValidation.ts` is a hand-written restatement of the zod
 * schema in `src/shared/items/assembly/descriptor.ts`, because api/ cannot
 * import from src/. Every fixture below is fed to BOTH and only their verdicts
 * are compared, so a limit the two sides move together stays green and a limit
 * only one of them moves fails. Boundary values are read off the client's own
 * clamps rather than restated, so this file never becomes a third copy.
 */
import { describe, expect, it } from 'vitest';

import {
  MAX_ASSEMBLY_DEPTH as API_MAX_ASSEMBLY_DEPTH,
  MAX_ASSEMBLY_PARTS as API_MAX_ASSEMBLY_PARTS,
  PART_TYPES,
  validateAssemblyStructure,
} from './assemblyValidation.js';

import {
  DEFAULT_PART_PARAMS,
  DEFAULT_PART_TRANSFORM,
  MAX_ASSEMBLY_DEPTH,
  MAX_ASSEMBLY_PARTS,
  assemblySchema,
  clampAssemblyBase,
  clampPartTransform,
  defaultCutterProfile,
} from '../../src/shared/items/assembly/descriptor.js';
import { ASSEMBLY_PART_TYPES } from '../../src/shared/types/assembly.js';
import type { AssemblyPartType, CutterProfile } from '../../src/shared/types/assembly.js';

type Json = Record<string, unknown>;

const node = (type: AssemblyPartType, extra: Json = {}): Json => ({
  id: `n-${type}`,
  type,
  params: DEFAULT_PART_PARAMS[type],
  transform: DEFAULT_PART_TRANSFORM,
  children: [],
  ...extra,
});

const structure = (parts: readonly unknown[], base: Json = { floorThickness: 2 }): Json => ({
  kind: 'assembly',
  schemaVersion: 1,
  base,
  mirrorAxis: 'x',
  parts,
});

const flatParts = (count: number): Json[] =>
  Array.from({ length: count }, (_, index) => node('post', { id: `p${index}` }));

const nestedPart = (depth: number): Json => {
  let deepest = node('post', { id: 'd1' });
  for (let level = 2; level <= depth; level += 1) {
    deepest = node('post', { id: `d${level}`, children: [deepest] });
  }
  return deepest;
};

// Keyed by the union so a newly added cutter shape fails to compile here
// rather than silently going unprobed.
const CUTTER_SHAPE_KEYS = {
  circle: true,
  rectangle: true,
  polygon: true,
  slot: true,
  path: true,
  outline: true,
} satisfies Record<CutterProfile['shape'], true>;

const CUTTER_SHAPES = Object.keys(CUTTER_SHAPE_KEYS) as (keyof typeof CUTTER_SHAPE_KEYS)[];

const TRANSFORM_HI = clampPartTransform({ x: 1e6, y: 1e6, seatZ: 1e6, rotZDeg: 1e6 });
const TRANSFORM_LO = clampPartTransform({ x: -1e6, y: -1e6, seatZ: -1e6, rotZDeg: -1e6 });
const TRANSFORM_KEYS = ['x', 'y', 'seatZ', 'rotZDeg'] as const;

const BASE_HI = clampAssemblyBase({
  floorThickness: 1e6,
  cornerRadius: 1e6,
  wedge: { angleDeg: 1e6, lowEdge: 'front' },
});
const BASE_LO = clampAssemblyBase({ floorThickness: -1e6, cornerRadius: -1e6 });
const BASE_HI_CORNER_RADIUS = BASE_HI.cornerRadius ?? 0;
const BASE_HI_WEDGE_ANGLE = BASE_HI.wedge?.angleDeg ?? 0;
const BASE_LO_CORNER_RADIUS = BASE_LO.cornerRadius ?? 0;

const FIXTURES: readonly (readonly [string, unknown])[] = [
  ...ASSEMBLY_PART_TYPES.map(
    (type) => [`${type} at its defaults`, structure([node(type)])] as const
  ),
  ...CUTTER_SHAPES.map(
    (shape) =>
      [
        `cutter profile: ${shape}`,
        structure([
          node('cutter', {
            params: { ...DEFAULT_PART_PARAMS.cutter, profile: defaultCutterProfile(shape) },
          }),
        ]),
      ] as const
  ),
  ['transform at its upper clamp', structure([node('post', { transform: TRANSFORM_HI })])],
  ['transform at its lower clamp', structure([node('post', { transform: TRANSFORM_LO })])],
  ...TRANSFORM_KEYS.flatMap(
    (key) =>
      [
        [
          `transform.${key} one past its upper clamp`,
          structure([
            node('post', { transform: { ...TRANSFORM_HI, [key]: TRANSFORM_HI[key] + 1 } }),
          ]),
        ],
        [
          `transform.${key} one past its lower clamp`,
          structure([
            node('post', { transform: { ...TRANSFORM_LO, [key]: TRANSFORM_LO[key] - 1 } }),
          ]),
        ],
      ] as const
  ),
  ['base at its upper clamp', structure([node('post')], { ...BASE_HI })],
  [
    'base.floorThickness one past its upper clamp',
    structure([node('post')], { ...BASE_HI, floorThickness: BASE_HI.floorThickness + 1 }),
  ],
  [
    'base.cornerRadius one past its upper clamp',
    structure([node('post')], { ...BASE_HI, cornerRadius: BASE_HI_CORNER_RADIUS + 1 }),
  ],
  [
    'base.wedge.angleDeg one past its upper clamp',
    structure([node('post')], {
      ...BASE_HI,
      wedge: { angleDeg: BASE_HI_WEDGE_ANGLE + 1, lowEdge: 'front' },
    }),
  ],
  [
    'base.wedge.lowEdge outside its enum',
    structure([node('post')], {
      ...BASE_HI,
      wedge: { angleDeg: BASE_HI_WEDGE_ANGLE, lowEdge: 'top' },
    }),
  ],
  ['base at its lower clamp', structure([node('post')], { ...BASE_LO })],
  [
    'base.floorThickness one past its lower clamp',
    structure([node('post')], { ...BASE_LO, floorThickness: BASE_LO.floorThickness - 1 }),
  ],
  [
    'base.cornerRadius one past its lower clamp',
    structure([node('post')], { ...BASE_LO, cornerRadius: BASE_LO_CORNER_RADIUS - 1 }),
  ],
  ['part count at the cap', structure(flatParts(MAX_ASSEMBLY_PARTS))],
  ['part count one past the cap', structure(flatParts(MAX_ASSEMBLY_PARTS + 1))],
  ['nesting at the cap', structure([nestedPart(MAX_ASSEMBLY_DEPTH)])],
  ['nesting one past the cap', structure([nestedPart(MAX_ASSEMBLY_DEPTH + 1)])],
  ['mirrorAxis outside its enum', { ...structure([node('post')]), mirrorAxis: 'z' }],
  ['unknown part type', structure([node('post', { type: 'sphere' })])],
];

describe('assembly limits (cross-boundary mirror)', () => {
  it('allows exactly the client part types', () => {
    expect(PART_TYPES).toEqual(new Set(ASSEMBLY_PART_TYPES));
  });

  it('caps part count where the client does', () => {
    expect(API_MAX_ASSEMBLY_PARTS).toBe(MAX_ASSEMBLY_PARTS);
  });

  it('caps nesting depth where the client does', () => {
    expect(API_MAX_ASSEMBLY_DEPTH).toBe(MAX_ASSEMBLY_DEPTH);
  });
});

describe('assembly structure validation (cross-boundary mirror)', () => {
  it('exercises both verdicts, so agreement is not vacuous', () => {
    const verdicts = FIXTURES.map(([, candidate]) => assemblySchema.safeParse(candidate).success);
    expect(verdicts).toContain(true);
    expect(verdicts).toContain(false);
  });

  it.each(FIXTURES)('%s: the schema and the server validator agree', (_label, candidate) => {
    expect(validateAssemblyStructure(candidate).valid).toBe(
      assemblySchema.safeParse(candidate).success
    );
  });
});
