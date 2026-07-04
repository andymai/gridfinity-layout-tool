import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutColorControls } from './CutoutColorControls';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_CUTOUT_COLOR } from '@/features/bin-designer/constants/defaults';
import type { Cutout } from '@/features/bin-designer/types';

const cutout = (o: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...o,
});

describe('CutoutColorControls', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().addCutout(cutout());
  });

  it('is unchecked and hides surface controls when uncolored', () => {
    render(
      <CutoutColorControls ids={['c1']} color={undefined} colorScope={undefined} disabled={false} />
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'binDesigner.cutouts.color.floor' })).toBeNull();
  });

  it('enabling the toggle applies the default color', () => {
    render(
      <CutoutColorControls ids={['c1']} color={undefined} colorScope={undefined} disabled={false} />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(useDesignerStore.getState().params.cutouts[0].color).toBe(DEFAULT_CUTOUT_COLOR);
  });

  it('shows the active scope and switches it on click', () => {
    useDesignerStore
      .getState()
      .setCutoutColor(['c1'], { color: '#ef4444', colorScope: 'floorAndWalls' });
    render(
      <CutoutColorControls
        ids={['c1']}
        color="#ef4444"
        colorScope="floorAndWalls"
        disabled={false}
      />
    );
    expect(
      screen.getByRole('button', { name: 'binDesigner.cutouts.color.floorAndWalls' })
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutouts.color.floor' }));
    expect(useDesignerStore.getState().params.cutouts[0].colorScope).toBe('floor');
  });

  it('clearing the toggle removes the color', () => {
    useDesignerStore.getState().setCutoutColor(['c1'], { color: '#ef4444' });
    render(
      <CutoutColorControls
        ids={['c1']}
        color="#ef4444"
        colorScope="floorAndWalls"
        disabled={false}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(useDesignerStore.getState().params.cutouts[0].color).toBeUndefined();
  });
});
