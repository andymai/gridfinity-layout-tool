import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { resetAllStores } from '@/test/testUtils';
import { BinOverhangExtensions } from './BinOverhangExtensions';
import { useLayoutStore } from '@/core/store';
import { createDefaultLayout } from '@/core/constants';
import { createTestBin } from '@/test/testUtils';
import { designId, gridUnits, mm } from '@/core/types';
import type { Bin, BinId, StoredBaseplateParams } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { DesignGeometryEntry } from '../LinkedBinMeshes/useDesignGeometries';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import { upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';

function setup(padding: Partial<StoredBaseplateParams> = {}) {
  useLayoutStore.setState({
    layout: {
      ...createDefaultLayout(),
      gridUnitMm: mm(42),
      baseplateParams: {
        magnetHoles: false,
        magnetDiameter: mm(6),
        magnetDepth: mm(2),
        paddingLeft: mm(0),
        paddingRight: mm(0),
        paddingFront: mm(0),
        paddingBack: mm(0),
        ...padding,
      },
    },
  });
}

function renderData(bin: Bin): BinRenderData {
  return {
    bin,
    x: bin.x,
    y: bin.y,
    z: 0,
    height: 2,
    clearanceHeight: 0,
    color: '#abc',
    opacity: 1,
  };
}

const edgeBin = (o: Partial<Bin> = {}) =>
  createTestBin({
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    depth: gridUnits(1),
    ...o,
  });

describe('BinOverhangExtensions', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.clear();
    resetCustomBinsCache();
    setup({ paddingLeft: mm(21) });
  });

  it('renders nothing when no bin extends', () => {
    const { container } = render(
      <BinOverhangExtensions
        bins={[renderData(edgeBin({ extendToMargin: false }))]}
        drawerWidth={5}
        drawerDepth={4}
        designGeometries={new Map()}
      />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(0);
  });

  it('renders a strip mesh for an extended edge bin', () => {
    const { container } = render(
      <BinOverhangExtensions
        bins={[renderData(edgeBin({ extendToMargin: true }))]}
        drawerWidth={5}
        drawerDepth={4}
        designGeometries={new Map()}
      />
    );
    expect(container.querySelectorAll('mesh').length).toBeGreaterThanOrEqual(1);
  });

  it('renders nothing for an extended bin linked to an imported mesh', () => {
    const design = designId('mesh');
    upsertRegistryEntry({
      id: design,
      name: 'mesh',
      width: 1,
      depth: 1,
      height: 3,
      kind: 'importedMesh',
      updatedAt: '2026-10-07T00:00:00.000Z',
    });
    const { container } = render(
      <BinOverhangExtensions
        bins={[renderData(edgeBin({ extendToMargin: true, linkedDesignId: design }))]}
        drawerWidth={5}
        drawerDepth={4}
        designGeometries={new Map()}
      />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(0);
  });

  it('renders two strips for a corner bin', () => {
    setup({ paddingLeft: mm(21), paddingFront: mm(42) });
    const { container } = render(
      <BinOverhangExtensions
        bins={[renderData(edgeBin({ extendToMargin: true }))]}
        drawerWidth={5}
        drawerDepth={4}
        designGeometries={new Map()}
      />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(2);
  });

  it("hangs a linked bin's strip from its design's body, not the floor", () => {
    const bin = edgeBin({ extendToMargin: true, linkedDesignId: designId('d1') });
    const geometries = new Map<BinId, DesignGeometryEntry>([
      [
        bin.id,
        { sig: 'd1:t1', geometry: new THREE.BufferGeometry(), width: 1, depth: 1, bodyBaseMm: 4.2 },
      ],
    ]);
    const { container } = render(
      <BinOverhangExtensions
        bins={[renderData(bin)]}
        drawerWidth={5}
        drawerDepth={4}
        designGeometries={geometries}
      />
    );
    const size = container.querySelector('boxGeometry')?.getAttribute('args')?.split(',');
    expect(Number(size?.[2])).toBeCloseTo(2 - 4.2 / 42, 5);
  });
});
