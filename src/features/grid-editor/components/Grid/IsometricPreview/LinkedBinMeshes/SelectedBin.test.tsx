import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import type { BinId } from '@/core/types';
import { binId, designId } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { SelectedBin } from './SelectedBin';
import type { DesignGeometryEntry } from './useDesignGeometries';

// Mock React Three Fiber — r3f intrinsics render as inert DOM elements
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('./LinkedBinMesh', () => ({
  LinkedBinMesh: () => <div data-testid="linked-bin-mesh" />,
}));

vi.mock('../BinMesh', () => ({
  BinMesh: () => <div data-testid="box-bin-mesh" />,
}));

const D1 = designId('design-1');
const B1 = binId('bin-1');

function makeBinData(overrides: Partial<BinRenderData> = {}): BinRenderData {
  return {
    bin: createTestBin(),
    x: 0,
    y: 0,
    z: 0,
    height: 1,
    clearanceHeight: 0,
    color: '#ff0000',
    opacity: 1,
    ...overrides,
  };
}

function makeEntry(): DesignGeometryEntry {
  return { sig: 'd1:t1', geometry: new THREE.BufferGeometry(), width: 1, depth: 1 };
}

describe('SelectedBin', () => {
  it('renders the real design mesh when the linked geometry is resolved', () => {
    const entry = makeEntry();
    const geometries = new Map<BinId, DesignGeometryEntry>([[B1, entry]]);
    const binData = makeBinData({ bin: createTestBin({ id: B1, linkedDesignId: D1 }) });

    const { queryByTestId } = render(
      <SelectedBin binData={binData} designGeometries={geometries} gridUnitMm={42} />
    );

    expect(queryByTestId('linked-bin-mesh')).not.toBeNull();
    expect(queryByTestId('box-bin-mesh')).toBeNull();
    entry.geometry.dispose();
  });

  it('falls back to the stylized box for unlinked or unresolved bins', () => {
    const { queryByTestId } = render(
      <SelectedBin binData={makeBinData()} designGeometries={new Map()} gridUnitMm={42} />
    );

    expect(queryByTestId('box-bin-mesh')).not.toBeNull();
    expect(queryByTestId('linked-bin-mesh')).toBeNull();
  });
});
