// @vitest-environment node
import { test, expect } from 'vitest';
import { initBrepkitKernel, loadGenerateBin } from './dualKernelInit';
import { withKernel, getKernel, measureVolume, getBounds } from 'brepjs';
import { getLastSolid, clearAllCaches } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

test('diagnose flat no-lip face counts', async () => {
  await initBrepkitKernel();
  const generateBin = await loadGenerateBin();
  const rawKernel = getKernel('brepkit').oc as any;
  
  clearAllCaches();
  const params = { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false } } as BinParams;
  
  withKernel('brepkit', () => generateBin(params));
  const bkSolid = withKernel('brepkit', () => getLastSolid());
  const solidId = (bkSolid as any).wrapped.id as number;
  
  // Surface types before unify
  const typesBefore = withKernel('brepkit', () => {
    const faces = Array.from(rawKernel.getSolidFaces(solidId)) as number[];
    const types: Record<string, number> = {};
    for (const fid of faces) {
      try { const t = rawKernel.getSurfaceType(fid) as string; types[t] = (types[t]||0)+1; } catch {}
    }
    return types;
  });
  
  const totalBefore = Object.values(typesBefore).reduce((a,b)=>a+b,0);
  
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
  
  // Measure volume, AABB, and entity counts BEFORE unify.
  const volBefore = withKernel('brepkit', () => measureVolume(bkSolid!));
  const countsBefore = withKernel('brepkit', () => {
    const c = rawKernel.getEntityCounts(solidId) as number[];
    return { faces: c[0], edges: c[1], verts: c[2] };
  });
  const bb = withKernel('brepkit', () => getBounds(bkSolid!));
  console.log(`  Volume before unify: ${volBefore.toFixed(2)} mm³`);
  console.log(`  AABB size: ${(bb.xMax-bb.xMin).toFixed(2)} × ${(bb.yMax-bb.yMin).toFixed(2)} × ${(bb.zMax-bb.zMin).toFixed(2)} mm`);
  console.log(`  Entity counts: F=${countsBefore.faces} E=${countsBefore.edges} V=${countsBefore.verts}`);
  console.log(`  Euler: ${countsBefore.verts - countsBefore.edges + countsBefore.faces}`);

  // Check edge types on the solid.
  const edgeTypeBreakdown = withKernel('brepkit', () => {
    const edges = Array.from(rawKernel.getSolidEdges(solidId)) as number[];
    const types: Record<string, number> = {};
    for (const eid of edges) {
      try { const t = rawKernel.getEdgeCurveType(eid) as string; types[t] = (types[t]||0)+1; } catch {}
    }
    return types;
  });
  console.log(`  Edge types: ${JSON.stringify(edgeTypeBreakdown)}`);
  console.log('');

  withKernel('brepkit', () => { rawKernel.unifyFaces(solidId); });
  
  // Re-fetch solid after unification to get updated shape reference
  const bkSolidAfter = withKernel('brepkit', () => getLastSolid());
  
  const typesAfter = withKernel('brepkit', () => {
    const faces = Array.from(rawKernel.getSolidFaces(solidId)) as number[];
    const types: Record<string, number> = {};
    for (const fid of faces) {
      try { const t = rawKernel.getSurfaceType(fid) as string; types[t] = (types[t]||0)+1; } catch {}
    }
    return types;
  });
  
  const totalAfter = Object.values(typesAfter).reduce((a,b)=>a+b,0);
  const facesRemoved = totalBefore - totalAfter;
  const reductionPct = ((facesRemoved / totalBefore) * 100).toFixed(1);
  
  console.log('AFTER unifyFaces():');
  console.log(`  Total face count: ${totalAfter}`);
  console.log('  Face types breakdown:');
  for (const [type, count] of Object.entries(typesAfter).sort((a, b) => b[1] - a[1])) {
    const beforeCount = typesBefore[type] || 0;
    const diff = count - beforeCount;
    console.log(`    ${type.padEnd(20)}: ${count.toString().padStart(3)} faces (${diff >= 0 ? '+' : ''}${diff})`);
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
}, 60000);

test('step-by-step volume: extrude then shell', async () => {
  await initBrepkitKernel();
  const { drawRoundedRectangle, shell, faceFinder, unwrap } = await import('brepjs');
  const kernel = getKernel('brepkit');
  const rawKernel = kernel.oc as any;

  withKernel('brepkit', () => {
    
    /* eslint-disable no-console */
    const outerW = 41.5, outerD = 41.5, r = 4, h = 21, t = 1.2;
    
    // Step 1: draw + extrude
    const sketch = drawRoundedRectangle(outerW, outerD, r);
    const sketchResult = sketch.sketchOnPlane('XY');
    // Count wire edges before extrude
    const wireId = ((sketchResult as any).wire?.wrapped?.id ?? (sketchResult as any).wire?.wrapped) as number;
    if (wireId !== undefined) {
      const wireEdges = Array.from(rawKernel.getWireEdges(wireId)) as number[];
      const wireEdgeTypes: Record<string, number> = {};
      for (const eid of wireEdges) {
        try { const t2 = rawKernel.getEdgeCurveType(eid) as string; wireEdgeTypes[t2] = (wireEdgeTypes[t2]||0)+1; } catch {}
      }
      console.log(`  Profile wire: ${wireEdges.length} edges, types: ${JSON.stringify(wireEdgeTypes)}`);
    }
    const box = sketchResult.extrude(h);
    const extrudeVol = measureVolume(box);
    const extrudeBB = getBounds(box);
    const expectedExtrude = (outerW * outerD - (4 - Math.PI) * r * r) * h;
    console.log('=== STEP-BY-STEP VOLUME DIAGNOSIS ===');
    console.log(`Step 1 - Extrude:`);
    console.log(`  Volume: ${extrudeVol.toFixed(2)} mm³ (expected: ${expectedExtrude.toFixed(2)})`);
    console.log(`  Rel error: ${(Math.abs(extrudeVol - expectedExtrude) / expectedExtrude * 100).toFixed(2)}%`);
    console.log(`  AABB: ${(extrudeBB.xMax-extrudeBB.xMin).toFixed(2)} × ${(extrudeBB.yMax-extrudeBB.yMin).toFixed(2)} × ${(extrudeBB.zMax-extrudeBB.zMin).toFixed(2)}`);
    const extId = (box as any).wrapped.id as number;
    const extCounts = rawKernel.getEntityCounts(extId) as number[];
    console.log(`  Entities: F=${extCounts[0]} E=${extCounts[1]} V=${extCounts[2]}`);
    const extFaces = Array.from(rawKernel.getSolidFaces(extId)) as number[];
    const extFaceTypes: Record<string, number> = {};
    for (const fid of extFaces) {
      try { const t2 = rawKernel.getSurfaceType(fid) as string; extFaceTypes[t2] = (extFaceTypes[t2]||0)+1; } catch {}
    }
    console.log(`  Face types: ${JSON.stringify(extFaceTypes)}`);
    const extEdges = Array.from(rawKernel.getSolidEdges(extId)) as number[];
    const extEdgeTypes: Record<string, number> = {};
    for (const eid of extEdges) {
      try { const t2 = rawKernel.getEdgeCurveType(eid) as string; extEdgeTypes[t2] = (extEdgeTypes[t2]||0)+1; } catch {}
    }
    console.log(`  Edge types: ${JSON.stringify(extEdgeTypes)}`);
    
    // Step 2: shell
    const topFaces = faceFinder().parallelTo('Z').atDistance(h, [0, 0, 0]).findAll(box);
    console.log(`  Top faces found for shell: ${topFaces.length}`);
    const shelled = unwrap(shell(box, topFaces, t));
    const shellVol = measureVolume(shelled);
    const shellBB = getBounds(shelled);
    
    const innerW = outerW - 2 * t, innerD = outerD - 2 * t, innerR = r - t;
    const expectedShell = expectedExtrude - (innerW * innerD - (4 - Math.PI) * innerR * innerR) * (h - t);
    console.log(`Step 2 - Shell:`);
    console.log(`  Volume: ${shellVol.toFixed(2)} mm³ (expected: ${expectedShell.toFixed(2)})`);
    console.log(`  Rel error: ${(Math.abs(shellVol - expectedShell) / expectedShell * 100).toFixed(2)}%`);
    console.log(`  AABB: ${(shellBB.xMax-shellBB.xMin).toFixed(2)} × ${(shellBB.yMax-shellBB.yMin).toFixed(2)} × ${(shellBB.zMax-shellBB.zMin).toFixed(2)}`);
    
    // Step 3: entity counts on shelled solid
    const shelledId = (shelled as any).wrapped.id as number;
    const counts = rawKernel.getEntityCounts(shelledId) as number[];
    console.log(`  Entities: F=${counts[0]} E=${counts[1]} V=${counts[2]}`);
    console.log('=====================================\n');
    /* eslint-enable no-console */

    const extrudeRelErr = Math.abs(extrudeVol - expectedExtrude) / expectedExtrude;
    expect(extrudeRelErr, 'extrude volume within 1%').toBeLessThan(0.01);

    const shellRelErr = Math.abs(shellVol - expectedShell) / expectedShell;
    expect(shellRelErr, 'shell volume within 1%').toBeLessThan(0.01);
  });
}, 60000);
