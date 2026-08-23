import { resolve } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { loadFont, isErr } from 'brepjs';
import { loadTestFonts } from '@/test/loadTestFonts';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { meshVolume, assertWatertight } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  createAssemblyPartNode,
  DEFAULT_ASSEMBLY_STRUCTURE,
  DEFAULT_PART_TRANSFORM,
} from '@/shared/items/assembly/descriptor';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';

const noop = (): void => undefined;
const env: ItemEnvelope = {
  width: 2,
  depth: 1,
  gridUnitMm: 42,
  heightUnitMm: 7,
  attachment: {
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    screwHoles: false,
    screwDiameter: 3,
  },
  featureColors: DEFAULT_BIN_PARAMS.featureColors,
};

function labeled(style: 'raised' | 'recessed', face: 'front' | 'top'): AssemblyStructure {
  const base = createAssemblyPartNode('block', 'b', { ...DEFAULT_PART_TRANSFORM, x: 42, y: 21 });
  const node = {
    ...base,
    params: { width: 60, depth: 24, height: 26, wedgeAngleDeg: 0, tiltDeg: 0 },
    label: { text: 'BITS', sizeMm: 8, depthMm: 0.8, style, face },
  } as AssemblyPartNode;
  return { ...DEFAULT_ASSEMBLY_STRUCTURE, parts: [node] };
}

describe('assembly part labels (real WASM)', () => {
  beforeAll(async () => {
    await initBrepjs();
    await loadTestFonts();
    const fontPath = resolve(
      __dirname,
      '../../../../shared/fonts/assets/AtkinsonHyperlegible-Regular.ttf'
    );
    const result = await loadFont(fontPath, 'atkinson');
    if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
  }, 30_000);

  it('raised front label adds volume, recessed removes it', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const plainStructure = { ...labeled('raised', 'front') };
    const plainNode = { ...plainStructure.parts[0] };
    delete (plainNode as { label?: unknown }).label;
    const plain = generateAssembly({ ...plainStructure, parts: [plainNode] }, env, noop, true);
    const raised = generateAssembly(labeled('raised', 'front'), env, noop, true);
    const recessed = generateAssembly(labeled('recessed', 'front'), env, noop, true);
    const top = generateAssembly(labeled('recessed', 'top'), env, noop, true);
    assertWatertight(raised);
    assertWatertight(recessed);
    assertWatertight(top);
    const v = meshVolume(plain);
    process.stdout.write(
      `plain=${v.toFixed(0)} raised=${meshVolume(raised).toFixed(0)} recessed=${meshVolume(recessed).toFixed(0)} top=${meshVolume(top).toFixed(0)}\n`
    );
    expect(meshVolume(raised)).toBeGreaterThan(v + 20);
    expect(meshVolume(recessed)).toBeLessThan(v - 20);
    expect(meshVolume(top)).toBeLessThan(v - 20);
  });

  it('every showcase template generates watertight at 4x2', { timeout: 90_000 }, async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const { buildWorkshopTemplate } =
      await import('@/features/bin-designer/utils/workshopTemplates');
    const bigEnv: ItemEnvelope = { ...env, width: 4, depth: 2 };
    for (const id of ['plierComb', 'screwdriverStation', 'angledBitBank', 'wrenchRail'] as const) {
      const structure: AssemblyStructure = {
        ...DEFAULT_ASSEMBLY_STRUCTURE,
        parts: buildWorkshopTemplate(id, bigEnv),
      };
      const result = generateAssembly(structure, bigEnv, noop, true);
      assertWatertight(result, id);
      expect(meshVolume(result)).toBeGreaterThan(10_000);
    }
  });
});
