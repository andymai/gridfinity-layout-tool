// @vitest-environment node
/**
 * Step-by-step volume diagnosis for brepkit rounded rectangle shell operation.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__kernel-tests__/diagnoseShell
 */
import { test, expect } from 'vitest';
import { withKernel, measureVolume, getBounds } from 'brepjs';
import { getLastSolid, clearAllCaches } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  initBrepkitKernel,
  loadGenerateBin,
  getRawBrepkitKernel,
  getSolidId,
} from './dualKernelInit';
import {
  collectFaceTypeBreakdown,
  collectEdgeTypeBreakdown,
  collectWireEdgeTypes,
  getEntityCounts,
  totalCount,
} from './topologyHelpers';
import { STANDARD_BIN_WIDTH, STANDARD_HEIGHT, SHELL_THICKNESS } from './testCases';

// ─── Constants ──────────────────────────────────────────────────────────────

const SHELL_RADIUS = 4; // mm

test('diagnose flat no-lip face counts', async () => {
  await initBrepkitKernel();
  const generateBin = await loadGenerateBin();
  const rawKernel = getRawBrepkitKernel();

  clearAllCaches();
  const params = {
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 1,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
  } as BinParams;

  withKernel('brepkit', () => generateBin(params));
  const bkSolid = withKernel('brepkit', () => getLastSolid());
  const solidId = getSolidId(bkSolid!);

  // Surface types before unify
  const typesBefore = withKernel('brepkit', () => collectFaceTypeBreakdown(rawKernel, solidId));
  const totalBefore = totalCount(typesBefore);

  // Entity counts and geometry before unify
  const volBefore = withKernel('brepkit', () => measureVolume(bkSolid!));
  const countsBefore = withKernel('brepkit', () => getEntityCounts(rawKernel, solidId));
  const bb = withKernel('brepkit', () => getBounds(bkSolid!));
  const edgeTypes = withKernel('brepkit', () => collectEdgeTypeBreakdown(rawKernel, solidId));

  /* eslint-disable no-console */
  console.log('\n=== FACE UNIFICATION DIAGNOSTIC ===');
  console.log(`Test Case: 1×1 flat no-lip bin`);
  console.log(`Bin Parameters: width=1, depth=1, style=flat, stackingLip=false`);
  console.log('');
  console.log('BEFORE unifyFaces():');
  console.log(`  Total face count: ${totalBefore}`);
  console.log('  Face types breakdown:');
  for (const [type, count] of Object.entries(typesBefore).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(20)}: ${count.toString().padStart(3)} faces`);
  }
  console.log('');
  console.log(`  Volume before unify: ${volBefore.toFixed(2)} mm³`);
  console.log(
    `  AABB size: ${(bb.xMax - bb.xMin).toFixed(2)} × ${(bb.yMax - bb.yMin).toFixed(2)} × ${(bb.zMax - bb.zMin).toFixed(2)} mm`
  );
  console.log(
    `  Entity counts: F=${countsBefore.faces} E=${countsBefore.edges} V=${countsBefore.verts}`
  );
  console.log(`  Euler: ${countsBefore.verts - countsBefore.edges + countsBefore.faces}`);
  console.log(`  Edge types: ${JSON.stringify(edgeTypes)}`);
  console.log('');

  withKernel('brepkit', () => {
    rawKernel.unifyFaces(solidId);
  });

  // Re-fetch solid after unification
  const bkSolidAfter = withKernel('brepkit', () => getLastSolid());

  const typesAfter = withKernel('brepkit', () => collectFaceTypeBreakdown(rawKernel, solidId));
  const totalAfter = totalCount(typesAfter);
  const facesRemoved = totalBefore - totalAfter;
  const reductionPct = ((facesRemoved / totalBefore) * 100).toFixed(1);

  console.log('AFTER unifyFaces():');
  console.log(`  Total face count: ${totalAfter}`);
  console.log('  Face types breakdown:');
  for (const [type, count] of Object.entries(typesAfter).sort((a, b) => b[1] - a[1])) {
    const beforeCount = typesBefore[type] || 0;
    const diff = count - beforeCount;
    console.log(
      `    ${type.padEnd(20)}: ${count.toString().padStart(3)} faces (${diff >= 0 ? '+' : ''}${diff})`
    );
  }
  console.log('');
  console.log('UNIFICATION IMPACT:');
  console.log(`  Faces removed: ${facesRemoved} (${reductionPct}% reduction)`);
  console.log(`  Face count change: ${totalBefore} → ${totalAfter}`);
  console.log('');

  // Check volume using the updated solid reference
  const vol = withKernel('brepkit', () => measureVolume(bkSolidAfter!));
  console.log('GEOMETRY VALIDATION:');
  console.log(`  Volume: ${vol.toFixed(2)} mm³`);
  console.log(`  Volume valid: ${vol > 0 ? 'YES' : 'NO'}`);
  console.log('===================================\n');
  /* eslint-enable no-console */

  expect(vol, 'volume should be positive').toBeGreaterThan(0);
}, 60_000);

test('step-by-step volume: extrude then shell', async () => {
  await initBrepkitKernel();
  const { drawRoundedRectangle, shell, faceFinder, unwrap } = await import('brepjs');
  const rawKernel = getRawBrepkitKernel();

  withKernel('brepkit', () => {
    /* eslint-disable no-console */
    const outerW = STANDARD_BIN_WIDTH;
    const outerD = STANDARD_BIN_WIDTH;
    const r = SHELL_RADIUS;
    const h = STANDARD_HEIGHT;
    const t = SHELL_THICKNESS;

    // Step 1: draw + extrude
    const sketchDrawing = drawRoundedRectangle(outerW, outerD, r);
    const sketchResult = sketchDrawing.sketchOnPlane('XY');

    // Count wire edges before extrude
    const wireWrapped = (sketchResult as { wire?: { wrapped?: { id: number } | number } }).wire
      ?.wrapped;
    const wireId = typeof wireWrapped === 'number' ? wireWrapped : wireWrapped?.id;
    if (wireId !== undefined) {
      const wireInfo = collectWireEdgeTypes(rawKernel, wireId);
      console.log(
        `  Profile wire: ${wireInfo.count} edges, types: ${JSON.stringify(wireInfo.types)}`
      );
    }

    const box = sketchResult.extrude(h);
    const extrudeVol = measureVolume(box);
    const extrudeBB = getBounds(box);
    const expectedExtrude = (outerW * outerD - (4 - Math.PI) * r * r) * h;

    console.log('=== STEP-BY-STEP VOLUME DIAGNOSIS ===');
    console.log(`Step 1 - Extrude:`);
    console.log(`  Volume: ${extrudeVol.toFixed(2)} mm³ (expected: ${expectedExtrude.toFixed(2)})`);
    console.log(
      `  Rel error: ${((Math.abs(extrudeVol - expectedExtrude) / expectedExtrude) * 100).toFixed(2)}%`
    );
    console.log(
      `  AABB: ${(extrudeBB.xMax - extrudeBB.xMin).toFixed(2)} × ${(extrudeBB.yMax - extrudeBB.yMin).toFixed(2)} × ${(extrudeBB.zMax - extrudeBB.zMin).toFixed(2)}`
    );

    const extId = getSolidId(box);
    const extCounts = getEntityCounts(rawKernel, extId);
    console.log(`  Entities: F=${extCounts.faces} E=${extCounts.edges} V=${extCounts.verts}`);

    const extFaceTypes = collectFaceTypeBreakdown(rawKernel, extId);
    console.log(`  Face types: ${JSON.stringify(extFaceTypes)}`);

    const extEdgeTypes = collectEdgeTypeBreakdown(rawKernel, extId);
    console.log(`  Edge types: ${JSON.stringify(extEdgeTypes)}`);

    // Step 2: shell
    const topFaces = faceFinder().parallelTo('Z').atDistance(h, [0, 0, 0]).findAll(box);
    console.log(`  Top faces found for shell: ${topFaces.length}`);
    const shelled = unwrap(shell(box, topFaces, t));
    const shellVol = measureVolume(shelled);
    const shellBB = getBounds(shelled);

    const innerW = outerW - 2 * t;
    const innerD = outerD - 2 * t;
    const innerR = r - t;
    const expectedShell =
      expectedExtrude - (innerW * innerD - (4 - Math.PI) * innerR * innerR) * (h - t);

    console.log(`Step 2 - Shell:`);
    console.log(`  Volume: ${shellVol.toFixed(2)} mm³ (expected: ${expectedShell.toFixed(2)})`);
    console.log(
      `  Rel error: ${((Math.abs(shellVol - expectedShell) / expectedShell) * 100).toFixed(2)}%`
    );
    console.log(
      `  AABB: ${(shellBB.xMax - shellBB.xMin).toFixed(2)} × ${(shellBB.yMax - shellBB.yMin).toFixed(2)} × ${(shellBB.zMax - shellBB.zMin).toFixed(2)}`
    );

    // Step 3: entity counts on shelled solid
    const shelledId = getSolidId(shelled);
    const counts = getEntityCounts(rawKernel, shelledId);
    console.log(`  Entities: F=${counts.faces} E=${counts.edges} V=${counts.verts}`);
    console.log('=====================================\n');
    /* eslint-enable no-console */

    const extrudeRelErr = Math.abs(extrudeVol - expectedExtrude) / expectedExtrude;
    expect(extrudeRelErr, 'extrude volume within 1%').toBeLessThan(0.01);

    const shellRelErr = Math.abs(shellVol - expectedShell) / expectedShell;
    expect(shellRelErr, 'shell volume within 1%').toBeLessThan(0.01);
  });
}, 60_000);
