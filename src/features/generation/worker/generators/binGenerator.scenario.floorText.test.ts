/**
 * Floor text.
 *
 * Positional claims a snapshot can't express: the caption sits on the floor top
 * and stays inside the floor slab, lands in one compartment, keeps off a raised
 * floor, and the floor pattern clears the glyphs.
 *
 *   pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.floorText
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont, isErr } from 'brepjs';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import type { BoundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, SurfaceTextConfig } from '@/shared/types/bin';
import { FeatureTag } from './featureTags';
import { deriveDimensions } from './pipeline/context';
import { computeFloorTextLayout, type FloorTextLayout } from './floorTextLayout';
import { standingFeatureKeepOuts } from './floorPatterns';
import { taperInsetAt } from './overhang';
import { resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { planLabelTabLayout } from '@/shared/utils/labelTabPlan';
import { planForContext as planWallLabelSlotsFor } from './wallLabelSlotBuilder';
import {
  retentionBossRadius,
  retentionMagnetInset,
  retentionMagnetPositions,
} from './retentionMagnetGeometry';
import type { MeshData } from '@/features/generation/bridge/types';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
  const file = 'AtkinsonHyperlegible-Regular.ttf';
  const buf = readFileSync(resolve(__dirname, `../../../../shared/fonts/assets/${file}`));
  const result = await loadFont(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
}, 30_000);

function makeParams(surfaceText?: SurfaceTextConfig, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, font: 'atkinson' },
    ...extra,
    ...(surfaceText !== undefined ? { surfaceText } : {}),
  };
}

const floor = (
  text: string,
  floorStyle: SurfaceTextConfig['floorStyle'] = {}
): SurfaceTextConfig => ({
  floorText: text,
  floorStyle,
});

function taggedVertices(m: MeshData, tag: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const fg of m.faceGroups ?? []) {
    if (fg.tag !== tag) continue;
    for (let i = fg.start; i < fg.start + fg.count; i++) {
      const v = m.indices[i] * 3;
      out.push([m.vertices[v], m.vertices[v + 1], m.vertices[v + 2]]);
    }
  }
  return out;
}

const textVertices = (m: MeshData): [number, number, number][] =>
  taggedVertices(m, FeatureTag.TEXT);

function floorTopZ(params: BinParams): number {
  const dim = deriveDimensions(params, false);
  return dim.baseOffsetZ + dim.floorThickness;
}

describe('floor text scenarios', () => {
  let generateBin: ReturnType<typeof getGenerateBin>;
  let plain: MeshData;
  let outer: BoundingBox;
  let floorZ: number;
  const floorThickness = deriveDimensions(makeParams(), false).floorThickness;

  beforeAll(() => {
    generateBin = getGenerateBin();
    plain = generateBin(makeParams());
    outer = boundingBox(plain.vertices);
    floorZ = floorTopZ(makeParams());
  });

  it.each(['engrave', 'emboss', 'flat'] as const)(
    '%s keeps the outer bbox and works on the floor top',
    (mode) => {
      const result = generateBin(makeParams(floor('ABC', { mode })));
      assertStructurallyValid(result, `floor ${mode}`);
      const box = boundingBox(result.vertices);
      for (const key of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const) {
        expect(Math.abs(box[key] - outer[key]), key).toBeLessThan(0.01);
      }

      const zs = textVertices(result).map(([, , z]) => z);
      expect(zs.length).toBeGreaterThan(0);
      const depth = DEFAULT_BIN_PARAMS.textDefaults.depth;
      if (mode === 'emboss') {
        expect(meshVolume(result)).toBeGreaterThan(meshVolume(plain));
        expect(Math.min(...zs)).toBeGreaterThan(floorZ - 0.05);
        expect(Math.max(...zs)).toBeGreaterThan(floorZ + depth - 0.05);
      } else if (mode === 'engrave') {
        expect(meshVolume(result)).toBeLessThan(meshVolume(plain));
        expect(Math.max(...zs)).toBeLessThan(floorZ + 0.05);
        expect(Math.min(...zs)).toBeLessThan(floorZ - depth + 0.05);
        expect(Math.min(...zs)).toBeGreaterThan(floorZ - floorThickness + 0.3);
      } else {
        expect(Math.abs(meshVolume(result) - meshVolume(plain))).toBeLessThan(0.5);
        expect(Math.max(...zs)).toBeLessThan(floorZ + 0.05);
        expect(Math.min(...zs)).toBeGreaterThan(floorZ - floorThickness);
      }
    }
  );

  it('engraves an inherited through-cut instead of piercing the floor', () => {
    const engraved = generateBin(makeParams(floor('AB', { mode: 'engrave' })));
    const inherited = generateBin(makeParams({ floorText: 'AB', style: { mode: 'through-cut' } }));
    expect(inherited.triangleCount).toBe(engraved.triangleCount);
    expect(Math.abs(meshVolume(inherited) - meshVolume(engraved))).toBeLessThan(0.01);
  });

  it('turns with floorTextRotation', () => {
    const spans = (rotation: 0 | 90): { x: number; y: number } => {
      const verts = textVertices(
        generateBin(makeParams({ ...floor('ABCDEF'), floorTextRotation: rotation }))
      );
      const xs = verts.map(([x]) => x);
      const ys = verts.map(([, y]) => y);
      return { x: Math.max(...xs) - Math.min(...xs), y: Math.max(...ys) - Math.min(...ys) };
    };
    const flat = spans(0);
    const turned = spans(90);
    expect(flat.x).toBeGreaterThan(flat.y);
    expect(turned.y).toBeGreaterThan(turned.x);
  });

  it('stays in one compartment when dividers cross the floor', () => {
    const compartments = {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 3,
      rows: 1,
      cells: [0, 1, 2],
    };
    const result = generateBin(makeParams(floor('AB'), { compartments }));
    assertStructurallyValid(result, 'floor text between dividers');
    const xs = textVertices(result).map(([x]) => x);
    expect(xs.length).toBeGreaterThan(0);
    const innerW = outer.maxX - outer.minX - 2 * DEFAULT_BIN_PARAMS.wallThickness;
    const cell = Math.floor((Math.min(...xs) + innerW / 2) / (innerW / 3));
    expect(Math.floor((Math.max(...xs) + innerW / 2) / (innerW / 3))).toBe(cell);
  });

  it('keeps off a raised compartment floor', () => {
    const compartments = {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 2,
      rows: 1,
      cells: [0, 1],
      floorRaises: [0, 10],
    };
    const result = generateBin(makeParams(floor('AB'), { compartments }));
    assertStructurallyValid(result, 'floor text beside a raised floor');
    const verts = textVertices(result);
    expect(verts.length).toBeGreaterThan(0);
    expect(Math.max(...verts.map(([x]) => x))).toBeLessThan(0);
    expect(Math.max(...verts.map(([, , z]) => z))).toBeLessThan(floorZ + 0.05);
  });

  // Flat text adds no volume of its own, so any gain is pattern left uncut.
  it('clears the floor pattern behind the glyphs', () => {
    const floorPattern = { enabled: true, pattern: 'round', scale: 0.5 } as const;
    const patterned = generateBin(makeParams(undefined, { floorPattern }));
    const result = generateBin(makeParams(floor('AB', { mode: 'flat' }), { floorPattern }));
    assertStructurallyValid(result, 'floor text + floor pattern');
    expect(textVertices(result).length).toBeGreaterThan(0);
    expect(meshVolume(result) - meshVolume(patterned)).toBeGreaterThan(5);
  });

  it.each([
    ['solid', { style: 'solid', base: { ...DEFAULT_BIN_PARAMS.base, solid: true } }],
    ['slotted', { style: 'slotted' }],
  ] as const)('builds nothing on a %s bin', (_name, extra) => {
    const without = generateBin(makeParams(undefined, extra));
    const result = generateBin(makeParams(floor('AB'), extra));
    expect(result.triangleCount).toBe(without.triangleCount);
  });

  it('exports watertight over magnet and screw pockets', () => {
    const base = { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw' as const };
    const result = generateBin(makeParams(floor('ABC'), { base }), undefined, true);
    assertWatertight(result, 'floor text export');
  });
});

type Box = { minX: number; maxX: number; minY: number; maxY: number };

// Settled ink may sit flush against an obstacle, so touching is not overlap.
const overlaps = (a: Box, b: Box, eps = 1e-6): boolean =>
  a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minY < b.maxY - eps && a.maxY > b.minY + eps;

function layoutOf(params: BinParams): {
  layout: FloorTextLayout;
  dim: ReturnType<typeof deriveDimensions>;
} {
  const dim = deriveDimensions(params, false);
  const layout = computeFloorTextLayout(params, dim);
  if (!layout) throw new Error('expected a floor caption');
  return { layout, dim };
}

describe('floor text placement', () => {
  // Pressed flush against the bound by an offset, so the margin cannot hide a
  // short inset.
  it.each([
    ['a tapered wall', 16, 4, 0],
    ['a taper band taller than the wall under a collar', 30, 2, 20],
  ] as const)(
    'keeps an edge-anchored caption inside %s',
    (_name, bandHeight, height, extraWallHeightMm) => {
      const overhang: BinParams['overhang'] = {
        left: 10,
        right: 0,
        front: 0,
        back: 0,
        feet: false,
        enabled: true,
        taper: {
          enabled: true,
          profile: 'chamfer',
          bandHeight,
          left: 10,
          right: 0,
          front: 0,
          back: 0,
        },
      };
      const { layout, dim } = layoutOf(
        makeParams(floor('ABCDEF', { anchor: 'left', mode: 'emboss', offset: { x: -60, y: 0 } }), {
          overhang,
          height,
          extraWallHeightMm,
        })
      );
      const taper = dim.overhang.taper;
      if (!taper) throw new Error('expected a taper');
      const shell = dim.wallHeight + dim.collarHeight;
      expect(shell).toBeGreaterThan(Math.min(bandHeight, dim.wallHeight));
      const lean = taperInsetAt(taper, taper.left, dim.floorThickness, shell);
      expect(lean).toBeGreaterThan(1);
      expect(layout.ink.minX).toBeGreaterThanOrEqual(-dim.innerW / 2 + lean - 1e-6);
    }
  );

  it.each(['engrave', 'emboss'] as const)(
    'keeps %s text off the screw bores through a detachable floor',
    (mode) => {
      const base = {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'screw' as const,
        feet: 'detachable' as const,
      };
      const params = makeParams(floor('ABCDEFGH', { anchor: 'bottom-left', mode }), { base });
      const { layout, dim } = layoutOf(params);
      const screw = resolveDetachableFeet(params).screw;
      if (!screw) throw new Error('expected screw bores');
      const r = screw.diameterMm / 2;
      for (const [x, y] of screw.positions) {
        const cx = x - dim.innerOffsetX;
        const cy = y - dim.innerOffsetY;
        const bore = { minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r };
        expect(overlaps(layout.ink, bore), `bore at ${cx}, ${cy}`).toBe(false);
      }
    }
  );

  it('holds an offset caption off the divider beside it', () => {
    const compartments = {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 2,
      rows: 1,
      cells: [0, 1],
    };
    for (const x of [-30, 30]) {
      const params = makeParams(floor('AB', { anchor: 'center', offset: { x, y: 0 } }), {
        width: 3,
        compartments,
      });
      const { layout, dim } = layoutOf(params);
      expect(layout.ink.minX).toBeGreaterThanOrEqual(-dim.innerW / 2);
      expect(layout.ink.maxX).toBeLessThanOrEqual(dim.innerW / 2);
      for (const k of standingFeatureKeepOuts(params, dim, { z0: 0, z1: dim.floorThickness })) {
        const keepOut = {
          minX: k.xMin - dim.innerOffsetX,
          maxX: k.xMax - dim.innerOffsetX,
          minY: k.yMin - dim.innerOffsetY,
          maxY: k.yMax - dim.innerOffsetY,
        };
        expect(overlaps(layout.ink, keepOut), `offset ${x}`).toBe(false);
      }
    }
  });

  // Measured on the built wall, not on the keep-out's own formula: the X span
  // of the divider's section at each height the glyphs occupy.
  it('clears a leaning divider over the height an emboss stands', async () => {
    const { mesh } = await import('brepjs');
    const { toIndexedMeshData } = await import('./meshUtils');
    const { buildCompartmentWalls } = await import('./compartmentBuilder');
    const compartments = {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 2,
      rows: 1,
      cells: [0, 1],
      dividerOverrides: [
        { compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: 0, rakeDeg: 30 },
      ],
    };
    const depth = 1.5;
    for (const x of [-60, 60]) {
      const params = makeParams(
        floor('AB', { anchor: 'center', offset: { x, y: 0 }, mode: 'emboss', depth }),
        { width: 3, compartments }
      );
      const { layout, dim } = layoutOf(params);
      const h = resolveCompartmentDividerHeight(
        params.compartments.dividerHeight,
        dim.interiorHeight
      );
      const wall = buildCompartmentWalls(params, dim.innerW, dim.innerD, h);
      if (!wall) throw new Error('expected a divider');
      const { vertices: v, indices } = toIndexedMeshData(
        mesh(wall, { tolerance: 0.01, angularTolerance: 0.1 })
      );
      wall.delete();
      let minX = Infinity;
      let maxX = -Infinity;
      for (const z of [dim.floorThickness, dim.floorThickness + layout.depth]) {
        for (let t = 0; t < indices.length; t += 3) {
          for (let e = 0; e < 3; e++) {
            const a = indices[t + e] * 3;
            const b = indices[t + ((e + 1) % 3)] * 3;
            if ((v[a + 2] - z) * (v[b + 2] - z) > 0 || v[a + 2] === v[b + 2]) continue;
            const k = (z - v[a + 2]) / (v[b + 2] - v[a + 2]);
            const ex = v[a] + k * (v[b] - v[a]);
            minX = Math.min(minX, ex);
            maxX = Math.max(maxX, ex);
          }
        }
      }
      expect(maxX - minX).toBeGreaterThan(params.compartments.thickness);
      const band = { minX, maxX, minY: -dim.innerD / 2, maxY: dim.innerD / 2 };
      expect(overlaps(layout.ink, band), `offset ${x}`).toBe(false);
    }
  });

  it('keeps out from under the lid-magnet pads', () => {
    const params = makeParams(floor('ABCDEFGH', { anchor: 'bottom-left' }), {
      height: 3,
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic' },
    });
    const { layout, dim } = layoutOf(params);
    const { diameter, edgeMagnets } = params.lid.retentionMagnet;
    const boss = retentionBossRadius(diameter);
    const pads = retentionMagnetPositions(
      params.width,
      params.depth,
      dim.gridUnitMmX,
      dim.gridUnitMmY,
      retentionMagnetInset(diameter),
      edgeMagnets,
      boss
    );
    expect(pads.length).toBeGreaterThan(0);
    for (const { x, y } of pads) {
      const pad = {
        minX: x > 0 ? x - boss : -dim.innerW / 2,
        maxX: x > 0 ? dim.innerW / 2 : x + boss,
        minY: y > 0 ? y - boss : -dim.innerD / 2,
        maxY: y > 0 ? dim.innerD / 2 : y + boss,
      };
      expect(overlaps(layout.ink, pad), `pad at ${x}, ${y}`).toBe(false);
    }
  });

  it('keeps out from under a label tab', () => {
    const params = makeParams(floor('ABCDEFGH', { anchor: 'top', mode: 'emboss' }), {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    });
    const { layout, dim } = layoutOf(params);
    const tabs = planLabelTabLayout(
      params,
      dim.innerW,
      dim.innerD,
      dim.interiorHeight,
      params.wallThickness
    );
    if (!tabs) throw new Error('expected label tabs');
    const slots = tabs.plannedRows.flatMap((row) => row.slots.map((slot) => ({ row, slot })));
    expect(slots.length).toBeGreaterThan(0);
    for (const { row, slot } of slots) {
      const reach = row.anchor === 'back' ? -row.dims.tabDepth : row.dims.tabDepth;
      const shelf = {
        minX: slot.tabXStart,
        maxX: slot.tabXStart + slot.tabWidth,
        minY: Math.min(slot.positionY, slot.positionY + reach),
        maxY: Math.max(slot.positionY, slot.positionY + reach),
      };
      expect(overlaps(layout.ink, shelf), `tab over cell ${slot.cellId}`).toBe(false);
    }
  });

  // No interior fillet, whose floor band would otherwise cover the bosses, and
  // an offset pressing the caption against the front wall.
  it('keeps off the wall-label-slot bosses', () => {
    const params = makeParams(
      floor('ABCDEFGH', { anchor: 'bottom', mode: 'emboss', offset: { x: 0, y: -60 } }),
      {
        height: 3,
        interiorFilletMm: 0,
        wallLabelSlots: {
          enabled: true,
          sides: { front: true, back: false, left: false, right: false },
          everyCells: 1,
        },
      }
    );
    const { layout, dim } = layoutOf(params);
    const plan = planWallLabelSlotsFor(params, dim);
    expect(plan.bossDepthMm).toBeGreaterThan(0);
    expect(plan.slots.length).toBeGreaterThan(0);
    for (const { offset } of plan.slots) {
      const boss = {
        minX: offset - plan.bossWidthMm / 2,
        maxX: offset + plan.bossWidthMm / 2,
        minY: -dim.innerD / 2,
        maxY: -dim.innerD / 2 + plan.bossDepthMm,
      };
      expect(overlaps(layout.ink, boss), `boss at ${offset}`).toBe(false);
    }
  });
});
