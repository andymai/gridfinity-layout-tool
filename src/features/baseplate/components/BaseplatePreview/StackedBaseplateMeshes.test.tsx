import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { StackPrintParams } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';

// Geometry/material hooks pull in three.js + a live WebGL context — mock the
// geometry hook so the component can be exercised in jsdom. The real stacking
// math is covered by stackPreview.test.ts.
vi.mock('./useMeshGeometry', () => ({
  useMeshGeometry: () => ({ geometry: null, edgesGeometry: null, hasPrecomputedNormals: false }),
}));

const layoutState = {
  layout: {
    drawer: { width: 4, depth: 3, fractionalEdgeX: 'end', fractionalEdgeY: 'end' },
    gridUnitMm: 42,
    baseplateParams: DEFAULT_BASEPLATE_PARAMS,
  },
};
vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (s: unknown) => unknown) => selector(layoutState),
}));
vi.mock('@/core/store/settings', () => ({
  useSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({ settings: { printSettings: { nozzleSizeMm: 0.4, maxPrintHeightMm: 250 } } }),
}));

const pageState = { tiling: null, generation: { mesh: null }, pieceMeshes: [] };
vi.mock('../../store/baseplatePageStore', () => ({
  useBaseplatePageStore: (selector: (s: unknown) => unknown) => selector(pageState),
}));

import { StackedBaseplateMeshes } from './StackedBaseplateMeshes';

const stack: StackPrintParams = { enabled: true, gapMm: 0.2 as never };

describe('StackedBaseplateMeshes', () => {
  it('renders nothing when no plate mesh is available yet', () => {
    const { container } = render(
      <StackedBaseplateMeshes stack={stack} color="#ffffff" separationMm={0} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
