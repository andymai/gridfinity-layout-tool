import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { CutoutFillControls } from './CutoutFillControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const WALL_3U = 21 - GRIDFINITY_SPEC.SOCKET_HEIGHT;

/** A 3u socketed bin walls WALL_3U, so a 4mm offset leaves a WALL_3U − 4 fill. */
function setBin(topOffset: number, fillReference: 'rim' | 'floor'): void {
  useDesignerStore.getState().setParam('height', 3);
  useDesignerStore.getState().updateCutoutConfig({ topOffset, fillReference });
}

const config = () => useDesignerStore.getState().params.cutoutConfig;

describe('CutoutFillControls', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('measures from the rim by default', () => {
    render(<CutoutFillControls />);
    expect(screen.getByRole('button', { name: 'binDesigner.cutouts.fillFromRim' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('binDesigner.cutouts.topOffset')).toBeInTheDocument();
  });

  it('switches the slider to the fill height when measuring from the floor', () => {
    setBin(4, 'floor');
    render(<CutoutFillControls />);
    expect(screen.getByText('binDesigner.cutouts.fillHeight')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.topOffset')).not.toBeInTheDocument();
  });

  it('writes the reference when a segment is clicked', () => {
    render(<CutoutFillControls />);
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutouts.fillFromFloor' }));
    expect(config().fillReference).toBe('floor');
  });

  it('stores an offset even while the slider shows a fill height', () => {
    // The point of the swap: one stored plane, shown from either end. A second
    // stored number would be a second source of truth for the same surface.
    setBin(4, 'floor');
    render(<CutoutFillControls />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '6' } });
    expect(config().topOffset).toBeCloseTo(WALL_3U - 6, 6);
  });

  it('shows the unselected reading, so the conversion is never hidden', () => {
    setBin(4, 'rim');
    render(<CutoutFillControls />);
    expect(screen.getByText(/fillAboveFloor/)).toBeInTheDocument();
  });

  it('bounds the offset slider short of the wall, so a fill always survives', () => {
    setBin(4, 'rim');
    render(<CutoutFillControls />);
    expect(screen.getByRole('slider')).toHaveAttribute('max', String(WALL_3U - 0.5));
  });
});
