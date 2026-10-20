// @vitest-environment node
/**
 * The hinge's pin bores, measured on the files a user prints.
 *
 * A bore runs horizontally in the print, so the side of it facing away from
 * the bed is an unsupported arch. The teardrop exists to make that side a
 * self-bridging peak. Which side faces the bed is decided by the export, not
 * the builder: the bin prints as built, while a lid is usually turned over onto
 * its top face. Only the exported mesh says where the peak ended up.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  DEFAULT_LID_HINGE_CONFIG,
  LID_HINGE_BORE_MM,
  LID_HINGE_ENTRY_BORE_MM,
} from '@/features/bin-designer/types/lid';
import type { BinParams } from '@/shared/types/bin';
import type { HingeKnuckle } from '@/shared/utils/hingeLidPlan';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { exportBin } from './binExporter';
import { exportLid } from './lidOrchestrator';
import { setLastSolid } from './shapeCache';

type Point = readonly [number, number];
type Segment = readonly [Point, Point];

/** How far in from each end of a bore's height its width is compared (mm). */
const END_PROBE_MM = 0.2;

function hingeParams(over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    ...over,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      ...over.lid,
      enabled: true,
      attachment: 'hinge',
      relieveInterior: true,
      hinge: { ...DEFAULT_LID_HINGE_CONFIG, side: 'back' },
    },
  };
}

function soup(data: ArrayBuffer): Float32Array {
  const parsed = parseSTLBinary(data);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  return parsed.value.vertices;
}

/**
 * The soup cut by the plane `x = at`, as (y, z) segments.
 *
 * Each crossing is interpolated from the edge's endpoints in a fixed order, so
 * the two triangles sharing an edge produce bit-identical points and the
 * segments chain by exact position.
 */
function sectionAtX(tris: Float32Array, at: number): Segment[] {
  const out: Segment[] = [];
  const crossing = (i: number, j: number): Point | null => {
    const [p, q] = tris[i] <= tris[j] ? [i, j] : [j, i];
    const dp = tris[p] - at;
    const dq = tris[q] - at;
    if (dp >= 0 === dq >= 0) return null;
    const t = dp / (dp - dq);
    return [
      tris[p + 1] + t * (tris[q + 1] - tris[p + 1]),
      tris[p + 2] + t * (tris[q + 2] - tris[p + 2]),
    ];
  };
  for (let i = 0; i + 8 < tris.length; i += 9) {
    const hits = [crossing(i, i + 3), crossing(i + 3, i + 6), crossing(i + 6, i)].filter(
      (h): h is Point => h !== null
    );
    if (hits.length === 2) out.push([hits[0], hits[1]]);
  }
  return out;
}

/** Group segments into connected loops by shared endpoints. */
function loops(segments: readonly Segment[]): Segment[][] {
  const key = (p: Point): string => `${p[0]},${p[1]}`;
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    let next = parent.get(r);
    while (next !== undefined && next !== r) {
      r = next;
      next = parent.get(r);
    }
    parent.set(k, r);
    return r;
  };
  for (const [a, b] of segments) {
    const ka = key(a);
    const kb = key(b);
    if (!parent.has(ka)) parent.set(ka, ka);
    if (!parent.has(kb)) parent.set(kb, kb);
    parent.set(find(ka), find(kb));
  }
  const groups = new Map<string, Segment[]>();
  for (const s of segments) {
    const root = find(key(s[0]));
    const group = groups.get(root) ?? [];
    group.push(s);
    groups.set(root, group);
  }
  return [...groups.values()];
}

function widthAtZ(loop: readonly Segment[], z: number): number {
  const ys: number[] = [];
  for (const [a, b] of loop) {
    if (a[1] >= z === b[1] >= z) continue;
    const t = (z - a[1]) / (b[1] - a[1]);
    ys.push(a[0] + t * (b[0] - a[0]));
  }
  return ys.length < 2 ? 0 : Math.max(...ys) - Math.min(...ys);
}

interface BoreSection {
  /** Which way the narrow end points, in the print frame: `up` is away from the bed. */
  readonly apex: 'up' | 'down' | 'round';
  /** Width across the bore, which is the round end's diameter. */
  readonly diameterMm: number;
  /**
   * Whether the bore lies in the half of the part nearer the bed (the export's
   * lowest point), which pins whether the export turned the part over.
   */
  readonly inBedHalf: boolean;
}

/**
 * The one bore hole in the export's cross-section at `x`.
 *
 * Classified by shape rather than against a centre computed from the plan, so
 * the measurement has no opinion of its own about where the axis is: a
 * teardrop's peak is a few tenths of a millimetre wide just below its tip,
 * where the round end is more than a millimetre wide the same distance in.
 */
function boreAt(tris: Float32Array, x: number): BoreSection {
  let bedZ = Infinity;
  let topZ = -Infinity;
  for (let i = 2; i < tris.length; i += 3) {
    bedZ = Math.min(bedZ, tris[i]);
    topZ = Math.max(topZ, tris[i]);
  }
  const bores = loops(sectionAtX(tris, x))
    .map((loop) => {
      const ys = loop.flatMap(([a, b]) => [a[0], b[0]]);
      const zs = loop.flatMap(([a, b]) => [a[1], b[1]]);
      return {
        loop,
        width: Math.max(...ys) - Math.min(...ys),
        zLo: Math.min(...zs),
        zHi: Math.max(...zs),
      };
    })
    .filter((l) => l.width > 1.5 && l.width < 2.2 && l.zHi - l.zLo > 1.5 && l.zHi - l.zLo < 3);
  if (bores.length !== 1) throw new Error(`expected one bore at x=${x}, found ${bores.length}`);
  const [{ loop, width, zLo, zHi }] = bores;
  const top = widthAtZ(loop, zHi - END_PROBE_MM);
  const bottom = widthAtZ(loop, zLo + END_PROBE_MM);
  const apex = top < bottom / 2 ? 'up' : bottom < top / 2 ? 'down' : 'round';
  return {
    apex,
    diameterMm: +width.toFixed(2),
    inBedHalf: (zLo + zHi) / 2 < (bedZ + topZ) / 2,
  };
}

/** A plane through the middle of a knuckle, nudged off any tessellation vertex. */
function midX(k: HingeKnuckle): number {
  return (k.lo + k.hi) / 2 + 0.0123;
}

function knuckles(params: BinParams): readonly HingeKnuckle[] {
  const { geometry } = planHingeLid(params);
  if (!geometry) throw new Error('expected hinge geometry');
  expect(geometry.alongX).toBe(true);
  expect(geometry.alongOffsetMm).toBe(0);
  return geometry.runs[0].knuckles;
}

async function exportedBin(params: BinParams): Promise<Float32Array> {
  // `exportBin` re-exports its last solid whatever the params.
  setLastSolid(null);
  return soup((await exportBin(params, 'stl')).data);
}

async function exportedLid(params: BinParams): Promise<Float32Array> {
  const result = await exportLid(params, 'stl');
  if (!result) throw new Error('expected a lid export');
  return soup(result.data);
}

describe('hinge pin bores in print orientation', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it('points the bin bores up, with the press-fit entry on the first bin knuckle', async () => {
    const params = hingeParams();
    const ks = knuckles(params);
    expect(ks.map((k) => k.owner).slice(0, 3)).toEqual(['bin', 'lid', 'bin']);
    const bin = await exportedBin(params);
    expect(boreAt(bin, midX(ks[0]))).toEqual({
      apex: 'up',
      diameterMm: LID_HINGE_ENTRY_BORE_MM,
      inBedHalf: false,
    });
    expect(boreAt(bin, midX(ks[2]))).toEqual({
      apex: 'up',
      diameterMm: LID_HINGE_BORE_MM,
      inBedHalf: false,
    });
  }, 300_000);

  it('points the lid bores up once the export lays the lid on its top face', async () => {
    const params = hingeParams();
    const lid = await exportedLid(params);
    for (const k of knuckles(params).filter((n) => n.owner === 'lid')) {
      expect({ x: +k.lo.toFixed(1), ...boreAt(lid, midX(k)) }).toEqual({
        x: +k.lo.toFixed(1),
        apex: 'up',
        diameterMm: LID_HINGE_BORE_MM,
        inBedHalf: true,
      });
    }
  }, 300_000);

  it('points the lid bores up on a tray lid, which the export leaves the right way up', async () => {
    const params = hingeParams({
      lid: { ...DEFAULT_BIN_PARAMS.lid, tray: { ...DEFAULT_BIN_PARAMS.lid.tray, enabled: true } },
    });
    const lid = await exportedLid(params);
    const k = knuckles(params).find((n) => n.owner === 'lid');
    if (!k) throw new Error('expected a lid knuckle');
    expect(boreAt(lid, midX(k))).toEqual({
      apex: 'up',
      diameterMm: LID_HINGE_BORE_MM,
      inBedHalf: false,
    });
  }, 300_000);
});
