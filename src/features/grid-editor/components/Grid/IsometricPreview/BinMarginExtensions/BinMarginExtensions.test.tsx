import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { BinMarginExtensions } from './BinMarginExtensions';
import { useLayoutStore, useLabsStore } from '@/core/store';
import { createDefaultLayout } from '@/core/constants';
import { createTestBin } from '@/test/testUtils';
import type { Bin, StoredBaseplateParams } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';

function setup(padding: Partial<StoredBaseplateParams> = {}, flag = true) {
  useLayoutStore.setState({
    layout: {
      ...createDefaultLayout(),
      gridUnitMm: 42,
      baseplateParams: {
        magnetHoles: false,
        magnetDiameter: 6,
        magnetDepth: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
        ...padding,
      },
    },
  });
  useLabsStore.setState((prev) => ({
    preferences: {
      ...prev.preferences,
      enabledFeatures: { ...prev.preferences.enabledFeatures, layout_overhang: flag },
    },
  }));
}

function renderData(bin: Bin): BinRenderData {
  return { bin, x: bin.x, y: bin.y, z: 0, height: 2, color: '#abc', opacity: 1 };
}

const edgeBin = (o: Partial<Bin> = {}) => createTestBin({ x: 0, y: 0, width: 1, depth: 1, ...o });

describe('BinMarginExtensions', () => {
  beforeEach(() => {
    resetAllStores();
    setup({ paddingLeft: 21 });
  });

  it('renders nothing when the flag is off', () => {
    setup({ paddingLeft: 21 }, false);
    const { container } = render(
      <BinMarginExtensions
        bins={[renderData(edgeBin({ extendToMargin: true }))]}
        drawerWidth={5}
        drawerDepth={4}
      />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(0);
  });

  it('renders nothing when no bin extends', () => {
    const { container } = render(
      <BinMarginExtensions
        bins={[renderData(edgeBin({ extendToMargin: false }))]}
        drawerWidth={5}
        drawerDepth={4}
      />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(0);
  });

  it('renders a strip mesh for an extended edge bin', () => {
    const { container } = render(
      <BinMarginExtensions
        bins={[renderData(edgeBin({ extendToMargin: true }))]}
        drawerWidth={5}
        drawerDepth={4}
      />
    );
    expect(container.querySelectorAll('mesh').length).toBeGreaterThanOrEqual(1);
  });

  it('renders two strips for a corner bin', () => {
    setup({ paddingLeft: 21, paddingFront: 42 });
    const { container } = render(
      <BinMarginExtensions
        bins={[renderData(edgeBin({ extendToMargin: true }))]}
        drawerWidth={5}
        drawerDepth={4}
      />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(2);
  });
});
