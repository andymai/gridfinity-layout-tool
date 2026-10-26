// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { shouldGenerateLid, slideLidPlanForParams, type BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { entryOpeningMm, newCrossingsAbovePlate } from './__kernel-tests__/slideLidSeating';
import { slideLid } from './scenarios/slideLid';

const cases = slideLid.map((s) => [s.name, buildParams(s.params)] as const);

describe('sliding lid scenarios', () => {
  // A blocked lid builds a plain bin, which passes every integrity check below.
  it.each(cases)('%s builds its lid', (_, params) => {
    expect(shouldGenerateLid(params)).toBe(true);
  });
});

runExportIntegrity(slideLid);

async function exportedMesh(params: BinParams): Promise<MeshData> {
  const { exportBin } = await import('./binExporter');
  const parsed = parseSTLBinary((await exportBin(params, 'stl')).data);
  if (!isOk(parsed)) throw new Error('expected a parseable STL');
  const { vertices, normals } = parsed.value;
  const triangleCount = vertices.length / 9;
  return {
    vertices,
    normals,
    indices: Uint32Array.from({ length: triangleCount * 3 }, (_, i) => i),
    edgeVertices: new Float32Array(0),
    triangleCount,
  };
}

describe('the exported bin keeps its channel', () => {
  beforeAll(async () => {
    const { initBrepjs } = await import('./__kernel-tests__/wasmInit');
    await initBrepjs();
  }, 120_000);

  // The file the user prints, probed against the same design with its lid off:
  // an export that dropped the track would still be one watertight shell.
  it.each(cases)('%s', async (_, params) => {
    const { geometry } = slideLidPlanForParams(params);
    if (!geometry) throw new Error('expected slide geometry');
    const bin = await exportedMesh(params);
    const bare = await exportedMesh({ ...params, lid: { ...params.lid, enabled: false } });
    const exported = { params, bin, geometry };

    expect(newCrossingsAbovePlate(exported, bare), 'retainers over the plate').toBeGreaterThan(8);
    expect(entryOpeningMm(exported), 'entry window').toBeGreaterThan(
      geometry.plate.thicknessMm - 0.05
    );
    expect(entryOpeningMm({ ...exported, bin: bare }), 'lidless entry wall').toBeLessThan(0.05);
  });
});
