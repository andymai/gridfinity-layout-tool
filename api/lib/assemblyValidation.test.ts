import { describe, it, expect } from 'vitest';
import { validateAssemblyEnvelope, validateAssemblyStructure } from './assemblyValidation.js';

const validEnvelope = {
  width: 4,
  depth: 2,
  gridUnitMm: 42,
  heightUnitMm: 7,
  attachment: {
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    screwHoles: false,
    screwDiameter: 3,
  },
  featureColors: { enabled: false },
};

const post = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  type: 'post',
  params: { diameter: 8, height: 40, taperDeg: 0, tipChamfer: 1 },
  transform: { x: 20, y: 20, seatZ: 0, rotZDeg: 0 },
  children: [],
  ...extra,
});

const structure = (parts: unknown[]): Record<string, unknown> => ({
  kind: 'assembly',
  schemaVersion: 1,
  base: { floorThickness: 2 },
  mirrorAxis: 'x',
  parts,
});

describe('validateAssemblyEnvelope', () => {
  it('accepts a standard envelope', () => {
    expect(validateAssemblyEnvelope(validEnvelope).valid).toBe(true);
  });

  it('rejects out-of-range footprints and units', () => {
    expect(validateAssemblyEnvelope({ ...validEnvelope, width: 50 }).valid).toBe(false);
    expect(validateAssemblyEnvelope({ ...validEnvelope, gridUnitMm: 500 }).valid).toBe(false);
    expect(
      validateAssemblyEnvelope({
        ...validEnvelope,
        attachment: { ...validEnvelope.attachment, magnetDiameter: 100 },
      }).valid
    ).toBe(false);
  });
});

describe('validateAssemblyStructure', () => {
  it('accepts a nested build with arrays, mirror, and cutters', () => {
    const result = validateAssemblyStructure(
      structure([
        post('rail', {
          type: 'block',
          params: { width: 100, depth: 12, height: 30, wedgeAngleDeg: 0 },
          mirror: true,
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
              transform: { x: 10, y: 0, seatZ: 0, rotZDeg: 0 },
              array: { count: 4, dx: 20, dy: 0 },
              children: [],
            },
          ],
        }),
      ])
    );
    expect(result.valid).toBe(true);
  });

  it('accepts every cutter profile variant', () => {
    const profiles = [
      { shape: 'circle', diameter: 6 },
      { shape: 'rectangle', width: 20, depth: 10, cornerRadius: 2 },
      { shape: 'polygon', diameter: 8, sides: 6 },
      { shape: 'slot', length: 40, width: 3 },
      {
        shape: 'path',
        points: [
          { x: 0, y: 0, handleIn: null, handleOut: { dx: 3, dy: 0 }, symmetric: false },
          { x: 20, y: 10, handleIn: { dx: -3, dy: 0 }, handleOut: null, symmetric: false },
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
      const result = validateAssemblyStructure(
        structure([
          post('c', {
            type: 'cutter',
            params: { profile, depth: 10, clearance: 0, chamfer: 0 },
          }),
        ])
      );
      expect(result.valid, profile.shape).toBe(true);
    }
  });

  it('rejects the caps: node count, depth, path points', () => {
    const many = Array.from({ length: 257 }, (_, i) => post(`p${i}`));
    expect(validateAssemblyStructure(structure(many)).valid).toBe(false);

    let chain = post('d1');
    for (let i = 2; i <= 9; i += 1) chain = post(`d${i}`, { children: [chain] });
    expect(validateAssemblyStructure(structure([chain])).valid).toBe(false);

    const hugePath = {
      shape: 'path',
      points: Array.from({ length: 2001 }, (_, i) => ({
        x: i % 100,
        y: 0,
        handleIn: null,
        handleOut: null,
        symmetric: false,
      })),
    };
    expect(
      validateAssemblyStructure(
        structure([
          post('c', {
            type: 'cutter',
            params: { profile: hugePath, depth: 5, clearance: 0, chamfer: 0 },
          }),
        ])
      ).valid
    ).toBe(false);
  });

  it('rejects out-of-range params, transforms, and unknown types', () => {
    expect(
      validateAssemblyStructure(
        structure([
          post('p', { params: { diameter: 9999, height: 40, taperDeg: 0, tipChamfer: 1 } }),
        ])
      ).valid
    ).toBe(false);
    expect(
      validateAssemblyStructure(
        structure([post('p', { transform: { x: 5000, y: 0, seatZ: 0, rotZDeg: 0 } })])
      ).valid
    ).toBe(false);
    expect(validateAssemblyStructure(structure([post('p', { type: 'sphere' })])).valid).toBe(false);
    expect(
      validateAssemblyStructure(structure([post('p', { array: { count: 1, dx: 5, dy: 0 } })])).valid
    ).toBe(false);
  });

  it('rejects wrong kind, version, base, and mirror axis', () => {
    expect(validateAssemblyStructure({ ...structure([]), kind: 'bin' }).valid).toBe(false);
    expect(validateAssemblyStructure({ ...structure([]), schemaVersion: 2 }).valid).toBe(false);
    expect(
      validateAssemblyStructure({ ...structure([]), base: { floorThickness: 99 } }).valid
    ).toBe(false);
    expect(validateAssemblyStructure({ ...structure([]), mirrorAxis: 'z' }).valid).toBe(false);
  });
});
