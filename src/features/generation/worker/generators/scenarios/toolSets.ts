import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { ToolSetSpec } from '@/shared/types/toolSet';
import type { MeshData } from '@/features/generation/bridge/types';
import { fromSplitFrame } from '@/shared/utils/cutoutSplit';
import { TOOL_FAMILIES } from '@/shared/toolSets/catalog';
import { generateToolSet, shiftCutout } from '@/shared/toolSets/generateToolSet';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';

/** No lip, so the mesh's top IS the fill surface the cuts are measured from. */
const FLAT = {
  ...DEFAULT_BIN_PARAMS.base,
  style: 'flat',
  solid: true,
  stackingLip: false,
} as const;

const MARGIN = 3;

const spec: ToolSetSpec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['8', '10', '13'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

function toolSetBin(): Partial<BinParams> {
  let n = 0;
  const set = generateToolSet(spec, TOOL_FAMILIES.combinationWrench, {
    setId: 'set',
    idFactory: () => `c${n++}`,
    names: { pocket: (s) => `${s} mm`, channel: 'Channel' },
  });
  if (!set) throw new Error('expected a tool set');
  const unit = DEFAULT_BIN_PARAMS.gridUnitMm;
  return {
    style: 'solid',
    base: FLAT,
    height: 5,
    width: Math.ceil((set.width + 2 * MARGIN + 4) / unit),
    depth: Math.ceil((set.depth + 2 * MARGIN + 4) / unit),
    cutouts: set.cutouts.map((c) => shiftCutout(c, MARGIN, MARGIN)),
  };
}

function dropAt(result: MeshData, params: BinParams, x: number, y: number): number {
  const bb = boundingBox(result.vertices);
  const innerW = bb.maxX - bb.minX - 2 * params.wallThickness;
  const innerD = bb.maxY - bb.minY - 2 * params.wallThickness;
  const crossings = columnCrossings(result, -innerW / 2 + x, -innerD / 2 + y);
  return bb.maxZ - (crossings.at(-1) ?? 0);
}

export const toolSets = [
  defineScenario('toolSets', 'a metric wrench set: box ends deeper than handles', {
    params: toolSetBin(),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      const pockets = params.cutouts.filter((c) => c.shape === 'path');
      expect(pockets).toHaveLength(3);
      for (const pocket of pockets) {
        const split = pocket.split;
        if (!split) throw new Error('expected a stepped pocket');
        const a = fromSplitFrame(pocket, split.a);
        const b = fromSplitFrame(pocket, split.b);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        // Right of a to b is side B, the box end.
        const nx = (b.y - a.y) / len;
        const ny = -(b.x - a.x) / len;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        expect(dropAt(result, params, mid.x + 3 * nx, mid.y + 3 * ny)).toBeCloseTo(
          split.cutDepth,
          0
        );
        expect(dropAt(result, params, mid.x - 12 * nx, mid.y - 12 * ny)).toBeCloseTo(
          pocket.cutDepth,
          0
        );
      }
    },
  }),
];
