import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSEMBLY_STRUCTURE,
  MAX_ASSEMBLY_DEPTH,
  MAX_ASSEMBLY_PARTS,
  assemblyDescriptor,
  assemblySchema,
  defaultPartParams,
} from '@/shared/items/assembly/descriptor';
import { ASSEMBLY_PART_TYPES } from '@/shared/types/assembly';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';

const envelope: ItemEnvelope = {
  width: 4,
  depth: 2,
  gridUnitMm: 42,
  heightUnitMm: 7,
  attachment: {
    magnetHoles: false,
    magnetDiameter: 6,
    magnetDepth: 2,
    screwHoles: false,
    screwDiameter: 3,
  },
  featureColors: { enabled: false } as never,
};

function asAssembly(value: unknown): AssemblyStructure {
  const parsed = assemblySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`expected a valid assembly: ${parsed.error.message}`);
  }
  return parsed.data;
}

function post(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    type: 'post',
    params: defaultPartParams('post'),
    transform: { x: 0, y: 0, seatZ: 0, rotZDeg: 0 },
    children: [],
    ...extra,
  };
}

function structureWith(parts: unknown[]): Record<string, unknown> {
  return { ...DEFAULT_ASSEMBLY_STRUCTURE, parts };
}

describe('assembly defaults', () => {
  it('returns a fresh, schema-valid, empty structure per call', () => {
    const a = assemblyDescriptor.defaults();
    const b = assemblyDescriptor.defaults();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    expect(asAssembly(a).kind).toBe('assembly');
    expect(asAssembly(a).schemaVersion).toBe(1);
    expect(asAssembly(a).parts).toEqual([]);
    const aa = asAssembly(a);
    const bb = asAssembly(b);
    expect(aa.base).toEqual(bb.base);
    expect(a).not.toBe(b);
  });

  it('has schema-valid default params for every part type', () => {
    for (const type of ASSEMBLY_PART_TYPES) {
      const node = {
        id: `default-${type}`,
        type,
        params: defaultPartParams(type),
        transform: { x: 0, y: 0, seatZ: 0, rotZDeg: 0 },
        children: [],
      };
      const result = assemblySchema.safeParse(structureWith([node]));
      expect(result.success, `default ${type} params should validate`).toBe(true);
    }
  });

  it('returns fresh param objects so callers can mutate safely', () => {
    const a = defaultPartParams('cutter');
    const b = defaultPartParams('cutter');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    if ('profile' in a && 'profile' in b) {
      expect(a.profile).not.toBe(b.profile);
    }
  });
});

describe('assembly schema', () => {
  it('round-trips a nested build with arrays, mirrors, and cutters', () => {
    const build = structureWith([
      {
        id: 'rail',
        type: 'block',
        params: { width: 160, depth: 12, height: 30, wedgeAngleDeg: 0, tiltDeg: 0 },
        transform: { x: 4, y: 60, seatZ: 0, rotZDeg: 0 },
        children: [
          {
            id: 'holes',
            type: 'cutter',
            params: {
              profile: { shape: 'circle', diameter: 7 },
              depth: 25,
              clearance: 0.2,
              chamfer: 0.6,
            },
            transform: { x: 12, y: 6, seatZ: 0, rotZDeg: 0 },
            array: { count: 6, dx: 24, dy: 0 },
            children: [],
          },
        ],
      },
      {
        id: 'divider',
        type: 'fin',
        params: { length: 60, thickness: 3, height: 25, leanDeg: 20 },
        transform: { x: 20, y: 10, seatZ: 0, rotZDeg: 90 },
        mirror: true,
        children: [],
      },
      {
        id: 'shadow',
        type: 'cutter',
        params: {
          profile: {
            shape: 'outline',
            points: [
              { x: 0, y: 0 },
              { x: 30, y: 0 },
              { x: 15, y: 50 },
            ],
          },
          depth: 8,
          clearance: 0.4,
          chamfer: 0,
        },
        transform: { x: 60, y: 20, seatZ: 0, rotZDeg: 15 },
        children: [],
      },
    ]);
    const parsed = assemblySchema.safeParse(build);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(build);
    }
  });

  it('accepts every cutter profile shape', () => {
    const profiles = [
      { shape: 'circle', diameter: 6 },
      { shape: 'rectangle', width: 20, depth: 10, cornerRadius: 2 },
      { shape: 'polygon', diameter: 8, sides: 6 },
      { shape: 'slot', length: 40, width: 3 },
      {
        shape: 'path',
        points: [
          { x: 0, y: 0, handleIn: null, handleOut: { dx: 5, dy: 0 }, symmetric: false },
          { x: 20, y: 10, handleIn: { dx: -5, dy: 0 }, handleOut: null, symmetric: false },
        ],
      },
      {
        shape: 'outline',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
        ],
      },
    ];
    for (const profile of profiles) {
      const node = {
        id: `cut-${profile.shape}`,
        type: 'cutter',
        params: { profile, depth: 10, clearance: 0.2, chamfer: 0 },
        transform: { x: 0, y: 0, seatZ: 0, rotZDeg: 0 },
        children: [],
      };
      const result = assemblySchema.safeParse(structureWith([node]));
      expect(result.success, `profile ${profile.shape} should validate`).toBe(true);
    }
  });

  it('rejects out-of-range params', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['fin lean past 45°', { type: 'fin', params: { ...defaultPartParams('fin'), leanDeg: 60 } }],
      [
        'tube wall below 0.8mm',
        { type: 'tube', params: { ...defaultPartParams('tube'), wall: 0.2 } },
      ],
      ['array of one', { array: { count: 1, dx: 10, dy: 0 } }],
      ['unknown part type', { type: 'sphere' }],
      [
        'triangle-beating polygon',
        {
          type: 'cutter',
          params: {
            profile: { shape: 'polygon', diameter: 8, sides: 2 },
            depth: 10,
            clearance: 0,
            chamfer: 0,
          },
        },
      ],
    ];
    for (const [label, extra] of cases) {
      const result = assemblySchema.safeParse(structureWith([post('p1', extra)]));
      expect(result.success, `${label} should be rejected`).toBe(false);
    }
  });

  it('caps total part count', () => {
    const parts = Array.from({ length: MAX_ASSEMBLY_PARTS + 1 }, (_, i) => post(`p${i}`));
    expect(assemblySchema.safeParse(structureWith(parts)).success).toBe(false);
    expect(
      assemblySchema.safeParse(structureWith(parts.slice(0, MAX_ASSEMBLY_PARTS))).success
    ).toBe(true);
  });

  it('caps stacking depth', () => {
    const chain = (depth: number): Record<string, unknown> =>
      post(`d${depth}`, depth > 1 ? { children: [chain(depth - 1)] } : {});
    expect(assemblySchema.safeParse(structureWith([chain(MAX_ASSEMBLY_DEPTH)])).success).toBe(true);
    expect(assemblySchema.safeParse(structureWith([chain(MAX_ASSEMBLY_DEPTH + 1)])).success).toBe(
      false
    );
  });
});

describe('assembly migrate', () => {
  const migrate = (raw: unknown): AssemblyStructure => assemblyDescriptor.migrate(raw, envelope);

  it('falls back to defaults on garbage', () => {
    for (const raw of [null, undefined, 42, 'rack', []]) {
      expect(migrate(raw)).toEqual(DEFAULT_ASSEMBLY_STRUCTURE);
    }
  });

  it('fills missing part params from defaults and generates missing ids', () => {
    const migrated = migrate({
      parts: [{ type: 'post', params: { diameter: 12 } }],
    });
    expect(migrated.parts).toHaveLength(1);
    const node = migrated.parts[0] as Extract<AssemblyPartNode, { type: 'post' }>;
    expect(node.type).toBe('post');
    expect(node.params.diameter).toBe(12);
    expect(node.params.height).toBe(defaultPartParams('post').height);
    expect(node.id.length).toBeGreaterThan(0);
    expect(node.transform).toEqual({ x: 0, y: 0, seatZ: 0, rotZDeg: 0 });
  });

  it('drops an unsalvageable node but keeps its valid siblings', () => {
    const migrated = migrate(
      structureWith([
        post('good'),
        { ...post('bad'), params: { ...defaultPartParams('post'), diameter: 9999 } },
        post('also-good'),
      ])
    );
    expect(migrated.parts.map((p) => p.id)).toEqual(['good', 'also-good']);
  });

  it('drops an invalid grandchild while keeping the parent chain', () => {
    const migrated = migrate(
      structureWith([
        post('root', {
          children: [
            post('child', {
              children: [{ ...post('grandchild'), type: 'nonsense' }],
            }),
          ],
        }),
      ])
    );
    expect(migrated.parts).toHaveLength(1);
    expect(migrated.parts[0]?.children).toHaveLength(1);
    expect(migrated.parts[0]?.children[0]?.children).toHaveLength(0);
  });

  it('strips an invalid array but keeps the node', () => {
    const migrated = migrate(
      structureWith([post('arrayed', { array: { count: 1, dx: 5, dy: 0 } })])
    );
    expect(migrated.parts).toHaveLength(1);
    expect(migrated.parts[0]?.array).toBeUndefined();
  });

  it('drops each invalid optional on its own, keeping the other', () => {
    const migrated = migrate(
      structureWith([
        post('bad-array', { array: { count: 1, dx: 5, dy: 0 }, mirror: true }),
        post('bad-mirror', { array: { count: 3, dx: 10, dy: 0 }, mirror: 'yes' }),
      ])
    );
    expect(migrated.parts).toHaveLength(2);
    expect(migrated.parts[0]?.array).toBeUndefined();
    expect(migrated.parts[0]?.mirror).toBe(true);
    expect(migrated.parts[1]?.array).toEqual({ count: 3, dx: 10, dy: 0 });
    expect(migrated.parts[1]?.mirror).toBeUndefined();
  });

  it('trims an over-cap build to the first parts instead of resetting it', () => {
    const parts = Array.from({ length: MAX_ASSEMBLY_PARTS + 40 }, (_, i) => post(`p${i}`));
    const migrated = migrate(structureWith(parts));
    expect(migrated.parts).toHaveLength(MAX_ASSEMBLY_PARTS);
    expect(migrated.parts[0]?.id).toBe('p0');
    expect(migrated.parts[MAX_ASSEMBLY_PARTS - 1]?.id).toBe(`p${MAX_ASSEMBLY_PARTS - 1}`);
  });

  it('prunes stacking beyond the depth cap instead of resetting the build', () => {
    const chain = (depth: number): Record<string, unknown> =>
      post(`d${depth}`, depth > 1 ? { children: [chain(depth - 1)] } : {});
    const migrated = migrate(structureWith([chain(MAX_ASSEMBLY_DEPTH + 3)]));
    let depth = 0;
    let level = migrated.parts;
    while (level.length > 0) {
      depth += 1;
      level = level[0]?.children ?? [];
    }
    expect(depth).toBe(MAX_ASSEMBLY_DEPTH);
  });

  it('resets an invalid base while keeping the parts', () => {
    const migrated = migrate({
      base: { floorThickness: 999 },
      parts: [post('kept')],
    });
    expect(migrated.base).toEqual(DEFAULT_ASSEMBLY_STRUCTURE.base);
    expect(migrated.parts.map((p) => p.id)).toEqual(['kept']);
  });

  it('forces kind and schemaVersion', () => {
    const migrated = migrate({ kind: 'toolRack', schemaVersion: 99 });
    expect(migrated.kind).toBe('assembly');
    expect(migrated.schemaVersion).toBe(1);
  });
});

describe('assembly descriptor', () => {
  it('derives the export file name from the footprint', () => {
    expect(assemblyDescriptor.exportFileName(envelope, assemblyDescriptor.defaults())).toBe(
      'workshop_4x2'
    );
  });
});
