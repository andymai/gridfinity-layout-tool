import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { createTestBin } from '@/test/testUtils';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { LinkedBinMesh } from './LinkedBinMesh';
import type { DesignGeometryEntry } from './useDesignGeometries';

// Mock React Three Fiber — r3f intrinsics render as inert DOM elements
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

function makeBinData(overrides: Partial<BinRenderData> = {}): BinRenderData {
  return {
    bin: createTestBin({ width: 2, depth: 1 }),
    x: 3,
    y: 4,
    z: 0.5,
    height: 1,
    clearanceHeight: 0,
    color: '#ff0000',
    opacity: 1,
    ...overrides,
  };
}

function makeEntry(width = 2, depth = 1): DesignGeometryEntry {
  return { sig: 'd1:t1', geometry: new THREE.BufferGeometry(), width, depth };
}

describe('LinkedBinMesh', () => {
  it('renders a group with a mesh bound to the shared design geometry', () => {
    const entry = makeEntry();
    const { container } = render(
      <LinkedBinMesh binData={makeBinData()} entry={entry} gridUnitMm={42} />
    );

    expect(container.querySelector('group')).not.toBeNull();
    expect(container.querySelector('mesh')).not.toBeNull();
    entry.geometry.dispose();
  });

  it('renders without crashing when selected', () => {
    const entry = makeEntry();
    const { container } = render(
      <LinkedBinMesh binData={makeBinData()} entry={entry} gridUnitMm={42} isSelected={true} />
    );

    expect(container.querySelector('meshStandardMaterial, meshstandardmaterial')).not.toBeNull();
    entry.geometry.dispose();
  });

  it('renders dimmed bins (exploded inactive layers) without crashing', () => {
    const entry = makeEntry();
    const { container } = render(
      <LinkedBinMesh binData={makeBinData({ opacity: 0.35 })} entry={entry} gridUnitMm={42} />
    );

    expect(container.querySelector('mesh')).not.toBeNull();
    entry.geometry.dispose();
  });
});
