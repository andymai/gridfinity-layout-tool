import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createTestBin } from '@/test/testUtils';
import type { BinId } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { DesignGeometryEntry } from '../LinkedBinMeshes/useDesignGeometries';
import { SlantSupportWedges } from './SlantSupportWedges';

const bin = createTestBin();
const withSupport: BinRenderData = {
  bin,
  x: 0,
  y: 0,
  z: 0,
  height: 1,
  clearanceHeight: 0,
  color: '#abc',
  opacity: 1,
  slantSupport: { side: 'back', x: 0, y: 1, width: 1, depth: 1, reach: 0.9, pivot: 0.1, top: 1 },
};

describe('SlantSupportWedges', () => {
  it('draws a wedge for a stylized bin with an end support', () => {
    const { container } = render(
      <SlantSupportWedges bins={[withSupport]} designGeometries={new Map()} />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(1);
  });

  it('leaves the support to a bin drawn from its design mesh', () => {
    const designGeometries = new Map<BinId, DesignGeometryEntry>([
      [bin.id, {} as DesignGeometryEntry],
    ]);
    const { container } = render(
      <SlantSupportWedges bins={[withSupport]} designGeometries={designGeometries} />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(0);
  });

  it('draws nothing for a bin without a support', () => {
    const { slantSupport: _, ...plain } = withSupport;
    const { container } = render(
      <SlantSupportWedges bins={[plain]} designGeometries={new Map()} />
    );
    expect(container.querySelectorAll('mesh')).toHaveLength(0);
  });
});
