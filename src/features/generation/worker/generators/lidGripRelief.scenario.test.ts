/**
 * Grip-relief geometry scenario tests.
 *
 * Runs the real brepjs/OpenCascade build and probes INSIDE the volume. A
 * relief that landed on the wrong wall, cut nothing, or broke through into
 * the mating cavity all leave a mesh that is watertight, has a plausible
 * triangle count, and passes every bounding-box assertion — so none of those
 * would catch it (CLAUDE.md gotcha #10). The probes here are the test.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidGripRelief.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  verticalSolidSpans,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  lidAnchorZ,
  resolveLidGripDepth,
  resolveLidGripHeightPlan,
  resolveLidCavityExtraMm,
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
  LID_GRIP_MIN_WALL_MM,
} from '@/shared/types/bin';
import type { BinParams, LidGripMode, LidGripConfig } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';
import type { CellMask } from '@/shared/utils/cellMask';

const DIMS = { width: 3, depth: 2, height: 4 } as const;

function makeParams(grip: Partial<LidGripConfig>, over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...DIMS,
    ...over,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      grip: { ...DEFAULT_BIN_PARAMS.lid.grip, ...grip },
    },
  };
}

/**
 * Seam plane in lid-local Z.
 *
 * `resolveLidCavityExtraMm` is not optional here: a tray lid's plate pushes the
 * cavity 4.8mm deeper, so a hardcoded 0 puts every probe that far above the
 * relief — in material the cutter never reaches, which is how the tray
 * variant's clamp came to be "covered" without being tested at all.
 */
function seamZ(params: BinParams): number {
  return lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(params));
}

/**
 * Is the lid solid over the whole Z band at this XY?
 *
 * Written against `verticalSolidSpans` rather than `isSolidThrough` so a
 * failure can report what the ray actually saw.
 */
function solidOver(mesh: MeshData, x: number, y: number, lo: number, hi: number): boolean {
  return verticalSolidSpans(mesh, x, y).some(([from, to]) => from <= lo + 0.01 && to >= hi - 0.01);
}

/**
 * Narrow a possibly-null mesh at the point of use.
 *
 * `generateLid` returns null when the lid is gated off; every call here
 * expects one, and CLAUDE.md prohibits non-null assertions, so the check and
 * the narrowing happen together and name what was missing.
 */
function requireMesh(mesh: MeshData | null, label: string): MeshData {
  if (mesh === null) throw new Error(`expected ${label} to build a lid`);
  return mesh;
}

const MODES: readonly LidGripMode[] = ['chamfer', 'reveal', 'scallop'];

beforeAll(async () => {
  await initBrepjs();
}, 120000);

describe('grip relief geometry', () => {
  it('leaves the lid untouched when the mode is none', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const off = requireMesh(generateLid(makeParams({ mode: 'none' })), 'a disabled relief');
    const noSides = requireMesh(
      generateLid(
        makeParams({
          mode: 'scallop',
          sides: { front: false, back: false, left: false, right: false },
        })
      ),
      'a relief with no enabled wall'
    );
    // A relief with no enabled wall must be byte-for-byte the disabled lid,
    // not a lid that happened to be cut somewhere harmless.
    expect(noSides.indices.length).toBe(off.indices.length);
    expect(noSides.vertices.length).toBe(off.vertices.length);
  });

  for (const mode of MODES) {
    describe(mode, () => {
      it('removes material at the relief and leaves the corners alone', async () => {
        const { generateLid } = await import('./lidOrchestrator');
        const params = makeParams({
          mode,
          sides: { front: true, back: true, left: false, right: false },
        });
        const withGrip = requireMesh(generateLid(params), `${mode} relief`);
        const without = requireMesh(generateLid(makeParams({ mode: 'none' })), 'a plain lid');
        assertStructurallyValid(withGrip, `${mode} relief`);
        assertWatertight(withGrip, `${mode} relief`);

        const anchorZ = seamZ(params);
        const depth = resolveLidGripDepth(params).depthMm;
        const height = resolveLidGripHeightPlan(params.lid.grip, anchorZ, depth).heightMm;
        expect(depth).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);

        // The BACK wall's outer face, at the centre of its span. Probe just
        // inside the face so the ray runs through what the relief removed.
        const bb = boundingBox(withGrip.vertices);
        const probeY = bb.maxY - depth / 2;
        // A band strictly inside the relief, clear of its own edges.
        const lo = anchorZ + Math.min(0.1, height / 4);
        const hi = anchorZ + height - Math.min(0.1, height / 4);

        expect(solidOver(without, 0, probeY, lo, hi)).toBe(true);
        expect(solidOver(withGrip, 0, probeY, lo, hi)).toBe(false);
      });

      it('does not reach the corners', async () => {
        const { generateLid } = await import('./lidOrchestrator');
        const params = makeParams({
          mode,
          sides: { front: true, back: true, left: false, right: false },
        });
        const mesh = requireMesh(generateLid(params), `${mode} relief`);

        const anchorZ = seamZ(params);
        const depth = resolveLidGripDepth(params).depthMm;
        const height = resolveLidGripHeightPlan(params.lid.grip, anchorZ, depth).heightMm;
        const bb = boundingBox(mesh.vertices);
        // Just inside the corner pillar, on the same wall the relief cuts.
        const cornerX = bb.maxX - LID_CORNER_RADIUS - 0.5;
        expect(
          solidOver(mesh, cornerX, bb.maxY - depth / 2, anchorZ + 0.1, anchorZ + height - 0.1)
        ).toBe(true);
      });

      it('never breaches the mating cavity', async () => {
        const { generateLid } = await import('./lidOrchestrator');
        const params = makeParams({
          mode,
          sides: { front: true, back: true, left: true, right: true },
        });
        const mesh = requireMesh(generateLid(params), `${mode} relief`);

        // The wall between the relief's deepest point and the cavity must
        // still be solid. A breach here leaves the lid watertight and passes
        // every triangle-count and bounding-box check, so this probe is the
        // only thing standing between a clamp bug and a hole in the lid.
        const anchorZ = seamZ(params);
        const depth = resolveLidGripDepth(params).depthMm;
        const bb = boundingBox(mesh.vertices);
        const wallMidY = bb.maxY - depth - LID_GRIP_MIN_WALL_MM / 2;
        expect(solidOver(mesh, 0, wallMidY, anchorZ + 0.05, anchorZ + 0.3)).toBe(true);
      });

      it('leaves a wall the user did not enable untouched', async () => {
        const { generateLid } = await import('./lidOrchestrator');
        const params = makeParams({
          mode,
          sides: { front: false, back: true, left: false, right: false },
        });
        const mesh = requireMesh(generateLid(params), `${mode} relief`);

        const anchorZ = seamZ(params);
        const depth = resolveLidGripDepth(params).depthMm;
        const height = resolveLidGripHeightPlan(params.lid.grip, anchorZ, depth).heightMm;
        const bb = boundingBox(mesh.vertices);
        const lo = anchorZ + Math.min(0.1, height / 4);
        const hi = anchorZ + height - Math.min(0.1, height / 4);

        // Back is cut, front is not — proves the placement respects sides and
        // that rotation put each cutter on the wall it was addressed to.
        expect(solidOver(mesh, 0, bb.maxY - depth / 2, lo, hi)).toBe(false);
        expect(solidOver(mesh, 0, bb.minY + depth / 2, lo, hi)).toBe(true);
      });
    });
  }
});

/**
 * The user-set relief height (follow-up).
 *
 * The reporter's complaint was not the pocket but what was left above it: the
 * lid exports upside down, so that skin's layer lines run across the pocket and
 * a thin one peels. A shorter pocket has to put material BACK in the band the
 * auto height cut, which no bounding box or triangle count can see: both lids
 * are closed surfaces of near-identical size.
 */
describe('grip relief height knob', () => {
  // A tall lid, so the auto 4mm scallop is not already clamped by the skirt and
  // there is room for the two heights to differ.
  const TALL = { extraHeightMm: 12 };

  function tallScallop(heightMm: number | null): BinParams {
    const params = makeParams({
      mode: 'scallop',
      heightMm,
      sides: { front: false, back: true, left: false, right: false },
    });
    return { ...params, lid: { ...params.lid, ...TALL } };
  }

  it('cuts a short pocket and leaves the band above it solid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const autoParams = tallScallop(null);
    const shortParams = tallScallop(1.5);

    const auto = requireMesh(generateLid(autoParams), 'an auto-height scallop');
    const short = requireMesh(generateLid(shortParams), 'a 1.5mm scallop');
    assertStructurallyValid(short, 'a 1.5mm scallop');
    assertWatertight(short, 'a 1.5mm scallop');

    const anchorZ = seamZ(shortParams);
    const depth = resolveLidGripDepth(shortParams).depthMm;
    expect(resolveLidGripHeightPlan(autoParams.lid.grip, anchorZ, depth).heightMm).toBe(4);
    expect(resolveLidGripHeightPlan(shortParams.lid.grip, anchorZ, depth).heightMm).toBe(1.5);

    const bb = boundingBox(short.vertices);
    const probeY = bb.maxY - depth / 2;
    // A band the 4mm pocket removes and the 1.5mm one does not.
    const lo = anchorZ + 2;
    const hi = anchorZ + 3.5;

    expect(solidOver(auto, 0, probeY, lo, hi)).toBe(false);
    expect(solidOver(short, 0, probeY, lo, hi)).toBe(true);
    // ...and the short pocket is still a pocket, not a no-op.
    expect(solidOver(short, 0, probeY, anchorZ + 0.3, anchorZ + 1.2)).toBe(false);
  });

  it('ignores a stored height in chamfer mode', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams({
      mode: 'chamfer',
      sides: { front: false, back: true, left: false, right: false },
    });
    const plain = { ...params, lid: { ...params.lid, ...TALL } };
    const carried = {
      ...plain,
      lid: { ...plain.lid, grip: { ...plain.lid.grip, heightMm: 8 } },
    };

    // The panel offers no height for a chamfer, so a value left over from
    // another mode must not change a single triangle.
    const a = requireMesh(generateLid(plain), 'a chamfer');
    const b = requireMesh(generateLid(carried), 'a chamfer with a stored height');
    expect(b.indices.length).toBe(a.indices.length);
    expect(b.vertices.length).toBe(a.vertices.length);
  });
});

/**
 * Every variant crossed with every mode.
 *
 * The point is coverage of the CLAMPS, not of the shapes: each variant puts a
 * different obstacle in the relief's way (a tray recess, edge-magnet bosses, a
 * reentrant polygon corner), and each clamp is only exercised by the variant
 * it belongs to. A mode that breached one of them would still tessellate
 * watertight, so the probe is the test.
 */
describe('grip relief variant matrix', () => {
  const L_SHAPE: CellMask = {
    cols: 6,
    rows: 6,
    // Bottom-first; the top-right 1x1 unit (2x2 mask cells) is missing.
    cells: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1,
      1, 1, 1, 0, 0,
    ],
  };

  const VARIANTS = [
    { name: 'plain', over: {} as Partial<BinParams>, lid: {} },
    {
      name: 'magnetic',
      over: {} as Partial<BinParams>,
      lid: {
        attachment: 'magnetic' as const,
        retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 2 },
      },
    },
    {
      name: 'tray',
      over: {} as Partial<BinParams>,
      lid: { tray: { enabled: true, depthMm: 4, wallMm: 3 } },
    },
    { name: 'polygon', over: { cellMask: L_SHAPE, width: 3, depth: 3 }, lid: {} },
  ] as const;

  for (const variant of VARIANTS) {
    for (const mode of MODES) {
      it(`${variant.name} + ${mode} builds a sound lid`, async () => {
        const { generateLid } = await import('./lidOrchestrator');
        const params: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          ...DIMS,
          ...variant.over,
          lid: {
            ...DEFAULT_BIN_PARAMS.lid,
            enabled: true,
            ...variant.lid,
            grip: {
              ...DEFAULT_BIN_PARAMS.lid.grip,
              mode,
              sides: { front: true, back: true, left: true, right: true },
            },
          },
        };
        const mesh = requireMesh(generateLid(params), `${variant.name}/${mode}`);
        assertStructurallyValid(mesh, `${variant.name}/${mode}`);
        assertWatertight(mesh, `${variant.name}/${mode}`);

        // Whatever the variant clamped the depth to, the wall in front of the
        // cavity must survive it.
        const plan = resolveLidGripDepth(params);
        if (plan.suppressed) return;
        const anchorZ = seamZ(params);
        const bb = boundingBox(mesh.vertices);
        const wallMidY = bb.maxY - plan.depthMm - LID_GRIP_MIN_WALL_MM / 2;
        expect(solidOver(mesh, 0, wallMidY, anchorZ + 0.05, anchorZ + 0.3)).toBe(true);
      });
    }
  }
});

describe('grip relief face provenance', () => {
  /**
   * `setShapeOrigin` REPLACES a shape's whole face-origin map, so tagging the
   * post-boolean solid stamps every face on the lid `LID_GRIP` and takes
   * LID_BODY / LID_RAIL / LID_LIP with it — silently killing the rail
   * hover-glow and any per-face colouring. The cutters carry the tag instead.
   */
  it('leaves the lid’s other feature tags intact', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const tags = (mesh: MeshData): Set<number> =>
      new Set((mesh.faceGroups ?? []).map((g) => g.tag));

    const plain = requireMesh(generateLid(makeParams({ mode: 'none' })), 'a plain lid');
    const relieved = requireMesh(
      generateLid(
        makeParams({
          mode: 'scallop',
          sides: { front: true, back: true, left: false, right: false },
        })
      ),
      'a relieved lid'
    );

    const plainTags = tags(plain);
    const relievedTags = tags(relieved);
    expect(plainTags.size).toBeGreaterThan(0);
    for (const tag of plainTags) {
      expect(relievedTags.has(tag), `tag ${tag} was wiped by the relief`).toBe(true);
    }
  });
});
