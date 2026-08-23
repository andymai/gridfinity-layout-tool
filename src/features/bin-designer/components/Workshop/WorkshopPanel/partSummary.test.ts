import { describe, expect, it } from 'vitest';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import {
  createAssemblyPartNode,
  DEFAULT_PART_TRANSFORM,
  defaultCutterProfile,
} from '@/shared/items/assembly/descriptor';
import { ASSEMBLY_PART_TYPES } from '@/shared/types/assembly';
import { partSummary } from './partSummary';

const node = (type: AssemblyPartNode['type']): AssemblyPartNode =>
  createAssemblyPartNode(type, `n-${type}`, { ...DEFAULT_PART_TRANSFORM });

describe('partSummary', () => {
  it.each(ASSEMBLY_PART_TYPES)('yields a non-empty numeric caption for %s', (type) => {
    expect(partSummary(node(type)).length).toBeGreaterThan(0);
  });

  it('distinguishes posts by their dimensions', () => {
    expect(partSummary(node('post'))).toBe('⌀8×40');
    const tall = {
      ...node('post'),
      params: { diameter: 12.5, height: 60, taperDeg: 0, tipChamfer: 1 },
    } as AssemblyPartNode;
    expect(partSummary(tall)).toBe('⌀12.5×60');
  });

  it('captions scanned cutters by their outline footprint', () => {
    const scanned = {
      ...node('cutter'),
      params: {
        profile: {
          shape: 'outline' as const,
          points: [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
            { x: 15, y: 52.4 },
          ],
        },
        depth: 10,
        clearance: 0.2,
        chamfer: 0,
      },
    } as AssemblyPartNode;
    expect(partSummary(scanned)).toBe('30×52.4');
    const hole = {
      ...node('cutter'),
      params: { profile: defaultCutterProfile('circle'), depth: 10, clearance: 0.2, chamfer: 0 },
    } as AssemblyPartNode;
    expect(partSummary(hole)).toBe('⌀6.5');
  });
});
