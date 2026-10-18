import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { SlantSide } from '@/core/types';
import type { SlantSupportRender } from '@/shared/hooks/useExplodedLayerView';
import { slantSupportPlacement, slantSupportWedge } from './slantSupportWedge';

describe('slantSupportWedge', () => {
  it('stands on its cells and rises to the bin top', () => {
    const geometry = slantSupportWedge(1, 2, 0.6, 0.1, 1.2);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new THREE.Box3();
    expect(box.min.toArray()).toEqual([0, 0, 0]);
    expect(box.max.x).toBeCloseTo(1, 6);
    expect(box.max.y).toBeCloseTo(2, 6);
    expect(box.max.z).toBeCloseTo(1.2, 6);
    geometry.dispose();
  });
});

describe('slantSupportPlacement', () => {
  const cells = { x: 3, y: 4, reach: 0.5, pivot: 0.1, top: 1 };
  // A support one cell long past a 2-wide bin, on each side.
  const supports: Record<SlantSide, SlantSupportRender> = {
    back: { ...cells, side: 'back', width: 2, depth: 1 },
    front: { ...cells, side: 'front', width: 2, depth: 1 },
    right: { ...cells, side: 'right', width: 1, depth: 2 },
    left: { ...cells, side: 'left', width: 1, depth: 2 },
  };

  it.each(Object.values(supports))('covers exactly its cells on the $side', (support) => {
    const { length, width, position, turn } = slantSupportPlacement(support);
    const toWorld = (u: number, w: number) =>
      new THREE.Vector3(u, w, 0)
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), turn)
        .add(new THREE.Vector3(position[0], position[1], 0));
    const box = new THREE.Box3().setFromPoints([toWorld(0, 0), toWorld(length, width)]);
    expect(box.min.x).toBeCloseTo(support.x, 6);
    expect(box.min.y).toBeCloseTo(support.y, 6);
    expect(box.max.x).toBeCloseTo(support.x + support.width, 6);
    expect(box.max.y).toBeCloseTo(support.y + support.depth, 6);
  });

  it('starts the climb at the edge facing the bin', () => {
    // A back support's frame starts on its front edge, where the bin stands.
    const { position, turn } = slantSupportPlacement(supports.back);
    const start = new THREE.Vector3(0, 0.5, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), turn);
    expect(position[1] + start.y).toBeCloseTo(supports.back.y, 6);
  });
});
