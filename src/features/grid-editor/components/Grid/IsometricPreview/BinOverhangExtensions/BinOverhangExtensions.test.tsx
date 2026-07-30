import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { BinOverhangExtensions } from './BinOverhangExtensions';
import { useLayoutStore } from '@/core/store';
import { createDefaultLayout } from '@/core/constants';
import { createTestBin } from '@/test/testUtils';
import { gridUnits, mm } from '@/core/types';
import type { Bin, StoredBaseplateParams } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';

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
    setup({ paddingLeft: mm(21) });
  });

  it('renders nothing when no bin extends', () => {
    const { container } = render(
      <BinOverhangExtensions
        bins={[renderData(edgeBin({ extendToMargin: false }))]}
        drawerWidth={5}
        drawerDepth={4}
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
      />
    );
    expect(container.querySelectorAll('mesh').length).toBeGreaterThanOrEqual(1);
  });

  it('renders two strips for a corner bin', () => {
    setup({ paddingLeft: mm(21), paddingFront: mm(42) });
    const { container } = render(
      <BinOverhangExtensions
        bins={[renderData(edgeBin({ extendToMargin: true }))]}
        drawerWidth={5}
        drawerDepth={4}
      />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(2);
  });
});
