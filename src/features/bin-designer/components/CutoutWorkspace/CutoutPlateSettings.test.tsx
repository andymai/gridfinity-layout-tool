import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutPlateSettings } from './CutoutPlateSettings';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
vi.mock('../panel/LabelTabsSection/LabelFitSampleButton', () => ({
  LabelFitSampleButton: () => <div data-testid="fit-sample" />,
}));
vi.mock('../panel/LabelTabsSection/LabelPlatesControls', () => ({
  LabelPlatesControls: () => <div data-testid="plate-export" />,
}));

import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';

const cutout = (o: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 40,
  y: 8,
  width: 25,
  depth: 18,
  cutDepth: 8,
  rotation: 0,
  cornerRadius: 0,
  label: 'M4',
  groupId: null,
  ...o,
});

function board(cutouts: Cutout[]) {
  const store = useDesignerStore.getState();
  useDesignerStore.setState({
    params: {
      ...store.params,
      width: 3,
      depth: 2,
      height: 4,
      style: 'solid',
      base: { ...store.params.base, solid: true, stackingLip: false },
      cutouts,
    },
  });
}

describe('CutoutPlateSettings', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  // The fit offset and the export belong to a board that has sockets; showing
  // them on every shadow board would be a printer setting with nothing to set.
  it('stays hidden until a cutout asks for a socket', () => {
    board([cutout()]);
    const { container } = render(<CutoutPlateSettings />);

    expect(container.firstChild).toBeNull();
  });

  it('reports the socket count and offers the export once one is planned', () => {
    board([cutout({ labelMode: 'socket', textAnchor: 'top' })]);
    render(<CutoutPlateSettings />);

    expect(screen.getByText('binDesigner.cutoutSocket.socketCount.one')).toBeTruthy();
    expect(screen.getByTestId('plate-export')).toBeTruthy();
  });

  // A cutout that asked for a socket and did not get one must be visible at
  // board level, or a partial set reads as a complete one.
  it('flags cutouts the plan could not place', () => {
    board([
      cutout({ id: 'ok', labelMode: 'socket', textAnchor: 'top' }),
      // Anchored onto its own cavity, which has nothing to cut a pocket into.
      cutout({ id: 'bad', x: 5, y: 40, labelMode: 'socket', textAnchor: 'center' }),
    ]);
    render(<CutoutPlateSettings />);

    expect(screen.getByRole('status').textContent).toBe('binDesigner.cutoutSocket.skippedCount');
  });

  it('writes the fit offset onto the design’s one plate-fit setting', () => {
    board([cutout({ labelMode: 'socket', textAnchor: 'top' })]);
    render(<CutoutPlateSettings />);

    const input = screen.getByLabelText('binDesigner.plateFitOffset');
    fireEvent.change(input, { target: { value: '0.15' } });
    fireEvent.blur(input);

    expect(useDesignerStore.getState().params.label.plateFitOffset).toBeCloseTo(0.15);
  });
});
