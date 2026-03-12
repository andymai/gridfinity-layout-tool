/**
 * Step-by-step diagnostic: exercises individual brepjs operations on
 * both OCCT and brepkit to pinpoint where they diverge.
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__test-infra__/diagnoseOps
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  withKernel,
  getBounds,
  drawRoundedRectangle,
  drawRectangle,
  describe as describeSolid,
  measureVolume,
  unwrap,
  faceFinder,
  shell,
} from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import { initOcctKernel, initBrepkitKernel } from './dualKernelInit';

// Helpers
function sketch(drawing: unknown, plane?: string, origin?: number): Sketch {
  const d = drawing as { sketchOnPlane: (p: string, o?: number) => Sketch };
  return d.sketchOnPlane(plane ?? 'XY', origin ?? 0);
}

function bounds(shape: Shape3D) {
  const b = getBounds(shape);
  return {
    x: +(b.xMax - b.xMin).toFixed(3),
    y: +(b.yMax - b.yMin).toFixed(3),
    z: +(b.zMax - b.zMin).toFixed(3),
  };
}

function stats(shape: Shape3D) {
  const d = describeSolid(shape);
  const vol = measureVolume(shape);
  return { faces: d.faceCount, edges: d.edgeCount, verts: d.vertexCount, valid: d.valid, vol: +vol.toFixed(1) };
}

type KernelName = 'occt' | 'brepkit';
const KERNELS: KernelName[] = ['occt', 'brepkit'];

describe('diagnose operations', () => {
  beforeAll(async () => {
    await initOcctKernel();
    await initBrepkitKernel();
  }, 60_000);

  it('simple box extrude: 41.5 x 41.5 x 21', () => {
    for (const k of KERNELS) {
      const result = withKernel(k, () => {
        const box = sketch(drawRoundedRectangle(41.5, 41.5, 3.75)).extrude(21);
        return { bounds: bounds(box), stats: stats(box) };
      });
      console.log(`[${k}] extrude:`, JSON.stringify(result));
      expect(result.bounds.z, `${k} Z`).toBeCloseTo(21, 0);
    }
  });

  it('simple rect extrude: 41.5 x 41.5 x 21', () => {
    for (const k of KERNELS) {
      const result = withKernel(k, () => {
        const box = sketch(drawRectangle(41.5, 41.5)).extrude(21);
        return { bounds: bounds(box), stats: stats(box) };
      });
      console.log(`[${k}] rect extrude:`, JSON.stringify(result));
      expect(result.bounds.z, `${k} Z`).toBeCloseTo(21, 0);
    }
  });

  it('shell: extrude then remove top face', () => {
    for (const k of KERNELS) {
      const result = withKernel(k, () => {
        const box = sketch(drawRoundedRectangle(41.5, 41.5, 3.75)).extrude(21);
        const topFaces = faceFinder().parallelTo('Z').atDistance(21, [0, 0, 0]).findAll(box);
        console.log(`[${k}] top faces found: ${topFaces.length}`);
        const shelled = unwrap(shell(box, topFaces, 1.2));
        return { bounds: bounds(shelled), stats: stats(shelled) };
      });
      console.log(`[${k}] shell:`, JSON.stringify(result));
      expect(result.bounds.z, `${k} Z`).toBeCloseTo(21, 0);
    }
  });

  it('rounded rect extrude: various sizes', () => {
    const cases = [
      { w: 10, d: 10, r: 2, h: 10, label: '10x10 r2 h10' },
      { w: 20, d: 20, r: 3, h: 10, label: '20x20 r3 h10' },
      { w: 41.5, d: 41.5, r: 3.75, h: 10, label: '41.5x41.5 r3.75 h10' },
      { w: 41.5, d: 41.5, r: 3.75, h: 21, label: '41.5x41.5 r3.75 h21' },
      { w: 41.5, d: 41.5, r: 0.5, h: 21, label: '41.5x41.5 r0.5 h21' },
      { w: 10, d: 10, r: 3.75, h: 21, label: '10x10 r3.75 h21' },
    ];
    for (const c of cases) {
      for (const k of KERNELS) {
        const result = withKernel(k, () => {
          const box = sketch(drawRoundedRectangle(c.w, c.d, c.r)).extrude(c.h);
          return bounds(box);
        });
        console.log(`[${k}] ${c.label}: Z=${result.z} (expected ${c.h})`);
      }
    }
  });

  it('volume: simple 10x10x10 cube', () => {
    for (const k of KERNELS) {
      const result = withKernel(k, () => {
        const cube = sketch(drawRectangle(10, 10)).extrude(10);
        return { bounds: bounds(cube), stats: stats(cube), vol: measureVolume(cube) };
      });
      console.log(`[${k}] cube:`, JSON.stringify(result));
      expect(result.vol, `${k} volume`).toBeCloseTo(1000, 0);
      expect(result.bounds.x, `${k} X`).toBeCloseTo(10, 1);
      expect(result.bounds.y, `${k} Y`).toBeCloseTo(10, 1);
      expect(result.bounds.z, `${k} Z`).toBeCloseTo(10, 1);
    }
  });
});
