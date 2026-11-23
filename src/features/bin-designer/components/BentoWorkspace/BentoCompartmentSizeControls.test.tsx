import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoCompartmentSizeControls } from './BentoCompartmentSizeControls';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { getEligibleDividers } from '@/features/bin-designer/utils/compartments';
import { compartmentCavityExact } from '@/features/bin-designer/utils/compartmentDimensions';
import { getDividerGeometry, getInteriorDims } from '@/features/bin-designer/utils/dividerAngle';
import type { ResizeWall } from '@/features/bin-designer/utils/compartmentResize';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const config: CompartmentConfig = { cols: 6, rows: 1, thickness: 1.2, cells: [0, 0, 1, 1, 2, 2] };

function setup() {
  useDesignerStore.setState(useDesignerStore.getInitialState());
  useDesignerStore.getState().setParam('compartments', config);
  const params = useDesignerStore.getState().params;
  const { innerW, innerD } = getInteriorDims(params);
  const walls: ResizeWall[] = getEligibleDividers(config).map((d) => ({
    ...d,
    geometry: getDividerGeometry({ ...params, dividerHeightMm: 30 }, config, d),
  }));
  return { innerW, innerD, walls };
}

describe('BentoCompartmentSizeControls', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes a typed width as a wall shift', () => {
    const { innerW, innerD, walls } = setup();
    render(
      <BentoCompartmentSizeControls
        config={config}
        compartmentId={0}
        interiorW={innerW}
        interiorD={innerD}
        walls={walls}
      />
    );

    const input = screen.getByRole('spinbutton', { name: 'binDesigner.bento.widthField' });
    fireEvent.change(input, { target: { value: '23' } });
    fireEvent.blur(input);

    const next = useDesignerStore.getState().params.compartments;
    expect(compartmentCavityExact(next, 0, innerW, innerD)?.width).toBeCloseTo(23, 2);
  });

  it('locks a size that no drawn neighbour can change, and says why', () => {
    const { innerW, innerD, walls } = setup();
    render(
      <BentoCompartmentSizeControls
        config={config}
        compartmentId={0}
        interiorW={innerW}
        interiorD={innerD}
        walls={walls}
      />
    );

    expect(screen.getByRole('spinbutton', { name: 'binDesigner.bento.depthField' })).toBeDisabled();
    expect(screen.getByText('binDesigner.bento.sizeLockedHint')).toBeInTheDocument();
  });
});
