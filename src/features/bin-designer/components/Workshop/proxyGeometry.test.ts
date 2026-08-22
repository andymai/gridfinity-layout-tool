import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { ASSEMBLY_PART_TYPES } from '@/shared/types/assembly';
import { createAssemblyPartNode, DEFAULT_PART_TRANSFORM } from '@/shared/items/assembly/descriptor';
import { buildPartGeometry, partFootprint, partSeatHeight } from './proxyGeometry';

const node = (type: (typeof ASSEMBLY_PART_TYPES)[number]): AssemblyPartNode =>
  createAssemblyPartNode(type, `n-${type}`, { ...DEFAULT_PART_TRANSFORM });

describe('buildPartGeometry', () => {
  it.each(ASSEMBLY_PART_TYPES)('builds finite, non-empty geometry for %s', (type) => {
    const geometry = buildPartGeometry(node(type));
    const positions = geometry.getAttribute('position');
    expect(positions.count).toBeGreaterThan(0);
    for (let i = 0; i < positions.count; i += 1) {
      expect(Number.isFinite(positions.getX(i))).toBe(true);
      expect(Number.isFinite(positions.getY(i))).toBe(true);
      expect(Number.isFinite(positions.getZ(i))).toBe(true);
    }
    geometry.dispose();
  });

  it.each(ASSEMBLY_PART_TYPES.filter((t) => t !== 'cutter'))(
    'seats %s on z=0 rising to its seat height',
    (type) => {
      const n = node(type);
      const geometry = buildPartGeometry(n);
      const bounds = new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never);
      expect(bounds.min.z).toBeCloseTo(0, 1);
      expect(bounds.max.z).toBeCloseTo(partSeatHeight(n), 1);
      geometry.dispose();
    }
  );

  it('sinks a cutter below its seat plane', () => {
    const n = node('cutter');
    const geometry = buildPartGeometry(n);
    const bounds = new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never);
    expect(bounds.max.z).toBeCloseTo(0, 1);
    expect(bounds.min.z).toBeCloseTo(n.type === 'cutter' ? -n.params.depth : 0, 1);
    geometry.dispose();
  });

  it.each(ASSEMBLY_PART_TYPES)('matches the declared footprint for %s', (type) => {
    const n = node(type);
    const geometry = buildPartGeometry(n);
    const bounds = new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never);
    const { w, d } = partFootprint(n);
    expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(w + 0.5);
    expect(bounds.max.y - bounds.min.y).toBeLessThanOrEqual(d + 20);
    geometry.dispose();
  });
});
