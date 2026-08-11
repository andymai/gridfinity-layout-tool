// @vitest-environment node
/**
 * Characterization: a `cellMask` (non-rectangular) bin silently drops its
 * compartment dividers and label tabs.
 *
 * `featuresStage` runs only builders that declare `supportsCellMask` once
 * `isPartialMask(params.cellMask)` holds, and only `handlesFeature` and
 * `wallCutoutsFeature` declare it. So a masked bin carrying a populated
 * `compartments` grid exports as an undivided polygon shell, and an enabled
 * `label` config produces no tabs — no error, no warning.
 *
 * Nothing else asserts this. The existing L/T-shape coverage in
 * `compartmentBuilder.scenario.manifold.test.ts` passes *because* of it: an
 * undivided shell is trivially watertight, so those tests confirm manifoldness
 * while the compartments they pass in are inert. `pipeline/context.ts` claims
 * masked bins "still use the additive-fuse path" and points at a skipped
 * "polygon-mask gap" scenario that does not exist in this repo; both are stale.
 *
 * Assertions compare triangle counts WITHIN a run rather than against
 * absolutes, since tessellation density is kernel-dependent.
 *
 * If polygon support lands for either builder, these tests fail. That is the
 * point: the failure is the signal to revisit anything that assumed a masked
 * bin can be divided.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  buildFullMask,
  isPartialMask,
  validateMask,
  MASK_CELLS_PER_UNIT,
} from '@/shared/utils/cellMask';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { exportBin } from './binExporter';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const TEST_TIMEOUT_MS = 120_000;

/** Triangle count plus the topology signals that would catch a split shell. */
function analyze(stl: ArrayBuffer): {
  triangleCount: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
} {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (base: number): string =>
    `${Math.round(vertices[base] * QUANTIZE)},${Math.round(vertices[base + 1] * QUANTIZE)},${Math.round(vertices[base + 2] * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const k = [vKey(base), vKey(base + 3), vKey(base + 6)];
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue;
    for (let i = 0; i < 3; i++) {
      const key = eKey(k[i], k[(i + 1) % 3]);
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeCount.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }
  return { triangleCount, boundaryEdges, nonManifoldEdges };
}

async function triangleCountOf(params: BinParams): Promise<number> {
  clearAllCaches();
  return analyze((await exportBin(params, 'stl')).data).triangleCount;
}

/** Full mask for `w × d` grid units with whole-unit quadrants cleared. */
function maskWithout(
  widthUnits: number,
  depthUnits: number,
  quadrants: readonly (readonly [number, number])[]
): CellMask {
  const mask = buildFullMask(widthUnits, depthUnits);
  const cells = [...mask.cells];
  const n = MASK_CELLS_PER_UNIT;
  for (const [qx, qy] of quadrants) {
    for (let dy = 0; dy < n; dy++) {
      for (let dx = 0; dx < n; dx++) {
        cells[(qy * n + dy) * mask.cols + (qx * n + dx)] = 0;
      }
    }
  }
  const result = { ...mask, cells };
  // Guards against an indexing slip silently yielding a full mask, which would
  // route every "masked" case below down the rectangle path and pass vacuously.
  expect(isPartialMask(result)).toBe(true);
  expect(validateMask(result)).toBeNull();
  return result;
}

const BASE: BinParams = { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2, height: 3 };
const HOLE = maskWithout(3, 2, [[2, 0]]);
/** 3×2 grid, row 0 at the bottom: two compartments per row. */
const CELLS = [0, 0, 1, 2, 3, 3];
const COMPARTMENTS = { cols: 3, rows: 2, cells: CELLS, thickness: 1.2 };
const LABEL_ON = { ...DEFAULT_BIN_PARAMS.label, enabled: true };

describe('polygon-mask gap — compartments and label tabs on non-rectangular bins', () => {
  it(
    'a RECTANGULAR bin honours both compartments and label tabs',
    async () => {
      const plain = await triangleCountOf(BASE);
      const divided = await triangleCountOf({ ...BASE, compartments: COMPARTMENTS });
      const withTabs = await triangleCountOf({
        ...BASE,
        compartments: COMPARTMENTS,
        label: LABEL_ON,
      });

      expect(divided, 'compartments must change rectangular geometry').not.toBe(plain);
      expect(withTabs, 'label tabs must change rectangular geometry').not.toBe(divided);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'a MASKED bin ignores its compartment grid',
    async () => {
      const undivided = await triangleCountOf({ ...BASE, cellMask: HOLE });
      const requested = await triangleCountOf({
        ...BASE,
        cellMask: HOLE,
        compartments: COMPARTMENTS,
      });

      expect(requested, 'masked bin currently exports undivided').toBe(undivided);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'a MASKED bin ignores enabled label tabs',
    async () => {
      const undivided = await triangleCountOf({ ...BASE, cellMask: HOLE });
      const requested = await triangleCountOf({
        ...BASE,
        cellMask: HOLE,
        compartments: COMPARTMENTS,
        label: LABEL_ON,
      });

      expect(requested, 'masked bin currently exports tab-less').toBe(undivided);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'the undivided masked export is still watertight',
    async () => {
      clearAllCaches();
      const stats = analyze(
        (await exportBin({ ...BASE, cellMask: HOLE, compartments: COMPARTMENTS }, 'stl')).data
      );
      expect(stats.boundaryEdges).toBe(0);
      expect(stats.nonManifoldEdges).toBe(0);
    },
    TEST_TIMEOUT_MS
  );
});
