// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { exportSlideTray, shouldGenerateSlideTray, slideInputForParams } from './slideOrchestrator';
import { resolveSlideGeometry } from './slideGeometry';

const enabled = { ...DEFAULT_BIN_PARAMS.slide, enabled: true };

describe('slide tray export', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it('produces nothing when the feature is off', async () => {
    const params = buildParams({ width: 3, depth: 2, height: 6 });
    expect(shouldGenerateSlideTray(params)).toBe(false);
    expect(await exportSlideTray(params, 'stl')).toBeNull();
  });

  it('exports a named STL for a standard bin', async () => {
    const params = buildParams({ width: 3, depth: 2, height: 6, slide: enabled });
    const result = await exportSlideTray(params, 'stl');
    expect(result).not.toBeNull();
    expect(result?.fileName).toBe('gridfinity-3x2-slide-tray.stl');
    expect(new DataView(result?.data ?? new ArrayBuffer(84)).getUint32(80, true)).toBeGreaterThan(
      0
    );
  }, 60_000);

  it('exports STEP under the step format', async () => {
    const params = buildParams({ width: 3, depth: 2, height: 6, slide: enabled });
    expect((await exportSlideTray(params, 'step'))?.fileName).toBe(
      'gridfinity-3x2-slide-tray.step'
    );
  }, 60_000);

  for (const [name, extra] of [
    ['a solid bin', { base: { ...DEFAULT_BIN_PARAMS.base, solid: true } }],
    ['a slotted bin', { style: 'slotted' as const }],
  ] as const) {
    it(`produces nothing for ${name}`, async () => {
      // The resolver's rejections are the single gate: the export path repeats
      // none of them, so a new rejection cannot be forgotten here.
      const params = buildParams({ width: 3, depth: 2, height: 6, ...extra, slide: enabled });
      expect(await exportSlideTray(params, 'stl')).toBeNull();
    }, 60_000);
  }

  it('resolves the same track the pipeline fuses onto the bin', () => {
    // The exported tray is dimensioned against this; if the two inputs drifted,
    // the tray would be built for a rail the bin does not have.
    const params = buildParams({ width: 3, depth: 2, height: 6, slide: enabled });
    const g = resolveSlideGeometry(slideInputForParams(params));
    expect(g.rejection).toBeNull();
    expect(g.tray).not.toBeNull();
    expect(g.rails.length).toBeGreaterThan(0);
  });
});
