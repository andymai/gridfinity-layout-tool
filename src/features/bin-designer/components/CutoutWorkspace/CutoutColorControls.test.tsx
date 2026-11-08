import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutColorControls } from './CutoutColorControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
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

const segment = (choice: string) =>
  screen.getByRole('button', { name: `binDesigner.cutouts.color.${choice}` });

const stored = () => useDesignerStore.getState().params.cutouts[0];

describe('CutoutColorControls', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().addCutout(cutout());
  });

  it('offers every surface while uncolored, with Off pressed and no swatch', () => {
    render(
      <CutoutColorControls ids={['c1']} color={undefined} colorScope={undefined} disabled={false} />
    );

    expect(segment('off')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('floor')).toHaveAttribute('aria-pressed', 'false');
    expect(segment('floorAndWalls')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(DEFAULT_CUTOUT_COLOR)).toBeNull();
  });

  it('colors an uncolored cutout floor-only in one click', () => {
    render(
      <CutoutColorControls ids={['c1']} color={undefined} colorScope={undefined} disabled={false} />
    );

    fireEvent.click(segment('floor'));

    expect(stored()).toMatchObject({ color: DEFAULT_CUTOUT_COLOR, colorScope: 'floor' });
    expect(useDesignerStore.getState().params.featureColors.enabled).toBe(true);
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
    expect(segment('floorAndWalls')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('off')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(segment('floor'));
    expect(stored()).toMatchObject({ color: '#ef4444', colorScope: 'floor' });
  });

  it('shows a color saved without a scope as the default it paints with', () => {
    render(
      <CutoutColorControls ids={['c1']} color="#ef4444" colorScope={undefined} disabled={false} />
    );

    expect(segment('floorAndWalls')).toHaveAttribute('aria-pressed', 'true');
  });

  it('presses nothing when the selection mixes scopes', () => {
    render(<CutoutColorControls ids={['c1']} color={null} colorScope={null} disabled={false} />);

    for (const choice of ['off', 'floor', 'floorAndWalls']) {
      expect(segment(choice)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('Off removes the color', () => {
    useDesignerStore.getState().setCutoutColor(['c1'], { color: '#ef4444' });
    render(
      <CutoutColorControls
        ids={['c1']}
        color="#ef4444"
        colorScope="floorAndWalls"
        disabled={false}
      />
    );

    fireEvent.click(segment('off'));

    expect(stored().color).toBeUndefined();
  });

  it('leaves a locked cutout alone', () => {
    render(<CutoutColorControls ids={['c1']} color={undefined} colorScope={undefined} disabled />);

    fireEvent.click(segment('floor'));

    expect(stored().color).toBeUndefined();
  });
});
