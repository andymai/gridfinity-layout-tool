// @vitest-environment node
/**
 * Step-by-step winding diagnosis for `buildBaseplateSolid` (issue #1494).
 *
 * Walks construction one BREP op at a time using the `BaseplateProbe` hook,
 * meshes each intermediate solid with the same tessellation parameters as
 * the production STL export path, and reports per-step winding metrics:
 *
 *   - directedEdgeCollisions — directed edges (a→b) appearing more than
 *     once across all triangles. In a closed orientable mesh each
 *     directed edge appears at most once; duplicates indicate triangles
 *     wound inconsistently relative to their neighbours.
 *   - signedVolume — divergence-theorem volume from the mesh. Positive
 *     means the mesh is consistently outward-oriented; negative means
 *     a dominant region is inverted.
 *
 * The test also runs a second pass that diffs raw `mesh()` output against
 * `repairMeshWinding(...)` output to report how many triangles the repair
 * actually flips. With brepjs 15.6.1 and the OCCT kernel, the repair flips
 * zero triangles for every known piece config including the user-reported
 * 13×9 magnet+lightweight+connector reproducer — i.e. the bug described in
 * #1490 is no longer observable downstream of `mesh()`. The repair remains
 * as a defensive net for any future regression in brepjs/OCCT tessellation.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__kernel-tests__/diagnoseBaseplateWinding
 *
 * The test is **diagnostic** — it always passes. Inspect the printed
 * tables to identify the first construction step at which a failing
 * config (corner-3 / corner-4 / edge-x-1) diverges from a passing one
 * (corner-1).
 */
import { test, beforeAll, beforeEach } from 'vitest';
import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { initBrepjs } from './wasmInit';
import {
  buildBaseplateSolid,
  clearBaseplateCaches,
  type BaseplateProbe,
} from '@/features/generation/worker/generators/baseplateGenerator';
import { repairMeshWinding } from '@/shared/generation/repairMeshWinding';

interface StepMetrics {
  readonly label: string;
  readonly triangleCount: number;
  readonly faceGroupCount: number;
  readonly directedEdgeCollisions: number;
  readonly signedVolume: number;
}

const QUANTIZE = 1e4;
function vKey(x: number, y: number, z: number): string {
  return `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
}

/**
 * Count directed-edge collisions and divergence-theorem volume on a flat
 * (vertices, triangles) pair. Mirrors the metrics in
 * `baseplateGenerator.scenario.winding.test.ts` so this diagnosis can be
 * cross-checked against the existing regression assertions.
 */
function metricsFromMesh(
  vertices: ArrayLike<number>,
  triangles: ArrayLike<number>
): { collisions: number; volume: number } {
  const triCount = triangles.length / 3;
  const seen = new Set<string>();
  let collisions = 0;
  let volume = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = triangles[t * 3] * 3;
    const i1 = triangles[t * 3 + 1] * 3;
    const i2 = triangles[t * 3 + 2] * 3;
    const ax = vertices[i0];
    const ay = vertices[i0 + 1];
    const az = vertices[i0 + 2];
    const bx = vertices[i1];
    const by = vertices[i1 + 1];
    const bz = vertices[i1 + 2];
    const cx = vertices[i2];
    const cy = vertices[i2 + 1];
    const cz = vertices[i2 + 2];
    const a = vKey(ax, ay, az);
    const b = vKey(bx, by, bz);
    const c = vKey(cx, cy, cz);
    const ab = `${a}->${b}`;
    const bc = `${b}->${c}`;
    const ca = `${c}->${a}`;
    if (seen.has(ab)) collisions++;
    else seen.add(ab);
    if (seen.has(bc)) collisions++;
    else seen.add(bc);
    if (seen.has(ca)) collisions++;
    else seen.add(ca);
    volume += ax * (by * cz - bz * cy) + bx * (cy * az - cz * ay) + cx * (ay * bz - az * by);
  }
  return { collisions, volume: volume / 6 };
}

function measureStep(label: string, shape: Shape3D): StepMetrics {
  const m = mesh(shape, { tolerance: 0.01, angularTolerance: 5 });
  const { collisions, volume } = metricsFromMesh(m.vertices, m.triangles);
  return {
    label,
    triangleCount: m.triangles.length / 3,
    faceGroupCount: m.faceGroups.length,
    directedEdgeCollisions: collisions,
    signedVolume: volume,
  };
}

function defaults(overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams {
  return {
    width: 4.5,
    depth: 4.5,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    lightweight: true,
    ...overrides,
  };
}

interface NamedConfig {
  readonly name: string;
  readonly params: ResolvedBaseplateParams;
}

// Mirror the configs covered by the existing scenario winding test plus the
// user-reported 13×9 reproducer from #1490.
const CONFIGS: readonly NamedConfig[] = [
  {
    name: 'corner-1',
    params: defaults({
      paddingLeft: 7,
      fractionalEdgeX: 'start',
      fractionalEdgeY: 'start',
      connectorNubs: true,
      edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'join' },
    }),
  },
  {
    name: 'corner-3',
    params: defaults({
      paddingLeft: 7,
      paddingBack: 7,
      fractionalEdgeX: 'start',
      fractionalEdgeY: 'end',
      connectorNubs: true,
      edges: { left: 'exterior', right: 'join', front: 'join', back: 'exterior' },
    }),
  },
  {
    name: 'corner-4',
    params: defaults({
      paddingRight: 7,
      paddingBack: 7,
      fractionalEdgeX: 'end',
      fractionalEdgeY: 'end',
      connectorNubs: true,
      edges: { left: 'join', right: 'exterior', front: 'join', back: 'exterior' },
    }),
  },
  {
    name: 'edge-x-1',
    params: defaults({
      width: 4.5,
      depth: 5,
      paddingRight: 7,
      fractionalEdgeX: 'end',
      connectorNubs: true,
      edges: { left: 'join', right: 'exterior', front: 'join', back: 'join' },
    }),
  },
  // User-reported reproducer (#1490): 13×9 padded baseplate with magnets +
  // lightweight cuts + connectors. The user's exported STLs from this config
  // were the original failure case that motivated the downstream repair.
  {
    name: 'user-13x9-magnets-padded',
    params: defaults({
      width: 13,
      depth: 9,
      paddingLeft: 7,
      paddingRight: 7,
      paddingFront: 7,
      paddingBack: 7,
      magnetHoles: true,
      lightweight: true,
      connectorNubs: true,
      edges: { left: 'exterior', right: 'exterior', front: 'exterior', back: 'exterior' },
    }),
  },
];

function formatStepRow(m: StepMetrics): string {
  return (
    `  ${m.label.padEnd(22)}` +
    `  tris=${m.triangleCount.toString().padStart(6)}` +
    `  faces=${m.faceGroupCount.toString().padStart(5)}` +
    `  edge-dupes=${m.directedEdgeCollisions.toString().padStart(6)}` +
    `  vol=${m.signedVolume.toFixed(0).padStart(10)}`
  );
}

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

// `buildBaseplateSolid` memoizes the rectangular slab + pockets via
// `slabWithPocketsCache`. Without clearing between configs (and between the
// two tests), the second invocation of any config short-circuits past the
// `slabExtruded` and `pocketsCut` probe events — defeating the step-walker's
// purpose. Clear before every test so each diagnostic walks the full
// construction path.
beforeEach(() => {
  clearBaseplateCaches();
});

test('diagnose: does repairMeshWinding actually flip triangles for these configs?', () => {
  /* eslint-disable no-console */
  console.log('\n========================================================================');
  console.log('  Raw mesh() vs repairMeshWinding output');
  console.log('========================================================================');
  for (const cfg of CONFIGS) {
    // Match the production export pipeline: forExport=false uses the
    // simplified pocket cutter (the multi-section loft that forExport=true
    // builds doesn't reliably tessellate or export — see exportBaseplate).
    const solid = buildBaseplateSolid(cfg.params, false);
    try {
      const m = mesh(solid, { tolerance: 0.01, angularTolerance: 5 });
      const before = metricsFromMesh(m.vertices, m.triangles);
      const repaired = repairMeshWinding(m.vertices, m.triangles);
      const after = metricsFromMesh(m.vertices, repaired);

      let flipped = 0;
      for (let t = 0; t < m.triangles.length; t += 3) {
        if (
          m.triangles[t] !== repaired[t] ||
          m.triangles[t + 1] !== repaired[t + 1] ||
          m.triangles[t + 2] !== repaired[t + 2]
        ) {
          flipped++;
        }
      }

      console.log(`  ${cfg.name.padEnd(24)}`);
      console.log(
        `    raw      : edge-dupes=${before.collisions.toString().padStart(6)}  ` +
          `vol=${before.volume.toFixed(0).padStart(10)}`
      );
      console.log(
        `    repaired : edge-dupes=${after.collisions.toString().padStart(6)}  ` +
          `vol=${after.volume.toFixed(0).padStart(10)}  ` +
          `triangles-flipped=${flipped}/${m.triangles.length / 3}`
      );
    } finally {
      solid.delete();
    }
  }
  console.log('========================================================================\n');
  /* eslint-enable no-console */
}, 300_000);

test('diagnose buildBaseplateSolid winding step-by-step', () => {
  /* eslint-disable no-console */
  console.log('\n========================================================================');
  console.log('  buildBaseplateSolid — per-step winding diagnosis (issue #1494)');
  console.log('========================================================================');
  console.log('  Metrics:');
  console.log('    edge-dupes  = directed edges appearing more than once across all triangles');
  console.log('                  (>0 means inconsistent triangle winding)');
  console.log('    vol         = signed mesh volume (negative => mesh is globally inverted)');

  const failures: string[] = [];
  for (const cfg of CONFIGS) {
    // `slabExtruded` only fires on the cache-miss path; clearing between
    // configs guarantees every config walks every milestone, even if two
    // ever shared a `slabWithPocketsCache` key.
    clearBaseplateCaches();

    console.log('\n------------------------------------------------------------------------');
    console.log(`  ${cfg.name}`);
    console.log('------------------------------------------------------------------------');
    const steps: StepMetrics[] = [];
    const probe: BaseplateProbe = (label, shape) => {
      steps.push(measureStep(label, shape));
    };
    try {
      // Match the production export pipeline (forExport=false).
      const solid = buildBaseplateSolid(cfg.params, false, undefined, probe);
      solid.delete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ! buildBaseplateSolid threw: ${msg}`);
      failures.push(`${cfg.name}: ${msg}`);
    }
    for (const m of steps) console.log(formatStepRow(m));
  }
  console.log('\n========================================================================\n');
  /* eslint-enable no-console */

  // Surface any per-config throws as a real test failure rather than only
  // a console line — silence is success-shaped in CI.
  if (failures.length > 0) {
    throw new Error(`buildBaseplateSolid threw for: ${failures.join('; ')}`);
  }
}, 300_000);
