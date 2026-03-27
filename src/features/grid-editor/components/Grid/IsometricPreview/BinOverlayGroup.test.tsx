import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BinOverlayGroup } from './BinOverlayGroup';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { Bin } from '@/core/types';

// Mock SplitLineOverlay to avoid R3F Canvas context requirement
vi.mock('./SplitLineOverlay', () => ({
  SplitLineOverlay: () => <div data-testid="split-line-overlay" />,
}));

function createBinRenderData(overrides: Partial<BinRenderData> = {}): BinRenderData {
  return {
    bin: {
      id: 'bin-1',
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 3,
      layerId: 'layer-1',
      category: 'cat-1',
      clearanceHeight: 0,
    } as Bin,
    x: 0,
    y: 0,
    z: 0,
    height: 0.5,
    clearanceHeight: 0,
    color: '#ff0000',
    opacity: 1,
    ...overrides,
  };
}

describe('BinOverlayGroup', () => {
  it('renders without crashing', () => {
    const binData = createBinRenderData();
    const { container } = render(<BinOverlayGroup binData={binData} maxGridUnits={6} />);
    expect(container).toBeTruthy();
  });

  it('renders with clearance height', () => {
    const binData = createBinRenderData({ clearanceHeight: 1.5 });
    const { container } = render(<BinOverlayGroup binData={binData} maxGridUnits={6} />);
    expect(container).toBeTruthy();
  });

  it('renders with oversized bin needing split lines', () => {
    const binData = createBinRenderData({
      bin: {
        id: 'bin-1',
        x: 0,
        y: 0,
        width: 10,
        depth: 10,
        height: 3,
        layerId: 'layer-1',
        category: 'cat-1',
        clearanceHeight: 0,
      } as Bin,
    });
    const { container } = render(<BinOverlayGroup binData={binData} maxGridUnits={6} />);
    expect(container).toBeTruthy();
  });
});
