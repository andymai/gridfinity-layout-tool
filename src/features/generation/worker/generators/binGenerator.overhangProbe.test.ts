// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isOk } from '@/core/result';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { clearAllCaches } from './shapeCache';

type ExportFn = (params: BinParams, format: 'stl') => Promise<{ data: ArrayBuffer }>;
let exportBin: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./binExporter');
  exportBin = mod.exportBin;
}, 60000);

const OVERHANG_DEG = 45;
const NZ_THRESHOLD = -Math.sin((OVERHANG_DEG * Math.PI) / 180);
const BRIDGE_NZ = -0.95;

function triNormalArea(v: Float32Array, i: number) {
  const ax = v[i + 3] - v[i],
    ay = v[i + 4] - v[i + 1],
    az = v[i + 5] - v[i + 2];
  const bx = v[i + 6] - v[i],
    by = v[i + 7] - v[i + 1],
    bz = v[i + 8] - v[i + 2];
  const cx = ay * bz - az * by,
    cy = az * bx - ax * bz,
    cz = ax * by - ay * bx;
  const len = Math.hypot(cx, cy, cz);
  if (len === 0) return { nz: 0, area: 0, minZ: Infinity };
  const minZ = Math.min(v[i + 2], v[i + 5], v[i + 8]);
  return { nz: cz / len, area: len / 2, minZ };
}

/** Downward-facing (support) + near-flat (bridge) area in a Z window above the bed. */
function analyzeWindow(v: Float32Array, loAbove: number, hiAbove: number) {
  let zMin = Infinity,
    zMax = -Infinity;
  for (let i = 2; i < v.length; i += 3) {
    if (v[i] < zMin) zMin = v[i];
    if (v[i] > zMax) zMax = v[i];
  }
  let total = 0,
    support = 0,
    bridge = 0;
  for (let i = 0; i < v.length; i += 9) {
    const t = triNormalArea(v, i);
    total += t.area;
    const z = t.minZ - zMin;
    if (z >= loAbove && z <= hiAbove && t.nz < NZ_THRESHOLD) {
      support += t.area;
      if (t.nz < BRIDGE_NZ) bridge += t.area;
    }
  }
  return { total, support, bridge, zMin, zMax };
}

const make = (over: Partial<BinParams>): BinParams => ({ ...DEFAULT_BIN_PARAMS, ...over });

// 2-wide bin. cols=3 → dividers at ~28/56mm cross the cup openings (cells at 21/63mm).
// cols=2 → divider at center (42mm) lands on the solid membrane between cups.
const midCellComp = { cols: 3, rows: 1, thickness: 1.2, cells: [0, 1, 2] };
const alignedComp = { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] };

// No lip — removes the lip's constant downward support face so the floor signal is isolated.
const lite = { ...DEFAULT_BIN_PARAMS.base, lightweight: true, stackingLip: false };
const solid = { ...DEFAULT_BIN_PARAMS.base, lightweight: false, stackingLip: false };

describe('lightweight floor overhang probe (dividers)', () => {
  it('quantifies cavity overhang introduced by the shelled floor', async () => {
    const cases: { name: string; params: BinParams }[] = [
      {
        name: 'solid floor, mid-cell dividers',
        params: make({ width: 2, depth: 1, base: solid, compartments: midCellComp }),
      },
      {
        name: 'LITE floor, mid-cell dividers',
        params: make({ width: 2, depth: 1, base: lite, compartments: midCellComp }),
      },
      {
        name: 'solid floor, aligned dividers',
        params: make({ width: 2, depth: 1, base: solid, compartments: alignedComp }),
      },
      {
        name: 'LITE floor, aligned dividers',
        params: make({ width: 2, depth: 1, base: lite, compartments: alignedComp }),
      },
      {
        name: 'LITE floor, no dividers',
        params: make({
          width: 2,
          depth: 1,
          base: lite,
          compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
        }),
      },
    ];
    const rows: string[] = [];
    const support: Record<string, number> = {};
    for (const { name, params } of cases) {
      // Export reuses a global `lastSolid` when it looks export-quality — clear
      // it (and the shape caches) per case or every bin reuses the first solid.
      clearAllCaches();
      const { data } = await exportBin(params, 'stl');
      const parsed = parseSTLBinary(data);
      expect(isOk(parsed)).toBe(true);
      if (!isOk(parsed)) continue;
      const v = parsed.value.vertices;
      // Window 4–9mm above bed isolates the cavity-floor / divider-underside band
      // (base is ~6mm tall; lip removed). Anything downward-facing here is the
      // shelled-floor recess wall or an unsupported divider bottom.
      const a = analyzeWindow(v, 4, 9);
      support[name] = a.support;
      rows.push(
        `  ${name.padEnd(34)} z=[${a.zMin.toFixed(1)},${a.zMax.toFixed(1)}] total=${a.total.toFixed(0)} support=${a.support.toFixed(0)}mm² bridge=${a.bridge.toFixed(0)}mm²`
      );
    }
    process.stdout.write(
      '\n=== Lightweight floor overhang probe (cavity, >4mm above bed) ===\n' +
        rows.join('\n') +
        '\n'
    );

    // Regression guard: the open-floor clip keeps dividers on solid foot cores,
    // so a lightweight bin must not add meaningful cavity overhang over its
    // solid-floor twin (allow a small tessellation margin). Without the clip,
    // mid-cell dividers tripled the support area (52 → ~146mm²).
    const MARGIN = 15; // mm²
    expect(support['LITE floor, mid-cell dividers']).toBeLessThan(
      support['solid floor, mid-cell dividers'] + MARGIN
    );
    expect(support['LITE floor, no dividers']).toBeLessThan(
      support['solid floor, mid-cell dividers'] + MARGIN
    );
  }, 120000);
});
