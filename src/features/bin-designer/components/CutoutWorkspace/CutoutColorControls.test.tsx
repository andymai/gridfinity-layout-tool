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

const pressed = () =>
  ['off', 'floor', 'floorAndWalls'].filter(
    (choice) => segment(choice).getAttribute('aria-pressed') === 'true'
  );

const stored = (id = 'c1') =>
  useDesignerStore.getState().params.cutouts.find((c) => c.id === id) as Cutout;

/** Seeds the store with these cutouts and renders the controls over them. */
function renderWith(cutouts: readonly Cutout[], disabled = false) {
  useDesignerStore.setState(useDesignerStore.getInitialState());
  for (const c of cutouts) useDesignerStore.getState().addCutout(c);
  render(<CutoutColorControls cutouts={cutouts} disabled={disabled} />);
}

describe('CutoutColorControls', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('offers every surface while uncolored, with Off pressed and no swatch', () => {
    renderWith([cutout()]);

    expect(pressed()).toEqual(['off']);
    expect(screen.queryByText(DEFAULT_CUTOUT_COLOR)).toBeNull();
  });

  it('colors an uncolored cutout floor-only in one click', () => {
    renderWith([cutout()]);

    fireEvent.click(segment('floor'));

    expect(stored()).toMatchObject({ color: DEFAULT_CUTOUT_COLOR, colorScope: 'floor' });
    expect(useDesignerStore.getState().params.featureColors.enabled).toBe(true);
  });

  it('shows the active scope and switches it on click', () => {
    renderWith([cutout({ color: '#ef4444', colorScope: 'floorAndWalls' })]);
    expect(pressed()).toEqual(['floorAndWalls']);

    fireEvent.click(segment('floor'));

    expect(stored()).toMatchObject({ color: '#ef4444', colorScope: 'floor' });
  });

  it('shows a color saved without a scope as the default it paints with', () => {
    renderWith([cutout({ color: '#ef4444' })]);

    expect(pressed()).toEqual(['floorAndWalls']);
  });

  it('leaves a scopeless color alone when its pressed surface is clicked again', () => {
    renderWith([cutout({ color: '#ef4444' })]);
    const history = useDesignerStore.getState().history.past.length;

    fireEvent.click(segment('floorAndWalls'));

    expect(stored().colorScope).toBeUndefined();
    expect(useDesignerStore.getState().history.past.length).toBe(history);
  });

  it('presses nothing when only some selected cutouts are colored', () => {
    renderWith([cutout({ id: 'a', color: '#ef4444' }), cutout({ id: 'b' })]);

    expect(pressed()).toEqual([]);
  });

  it('presses the surface two cutouts share, saved or by default', () => {
    renderWith([
      cutout({ id: 'a', color: '#ef4444' }),
      cutout({ id: 'b', color: '#3b82f6', colorScope: 'floorAndWalls' }),
    ]);

    expect(pressed()).toEqual(['floorAndWalls']);
    expect(screen.getByText('binDesigner.cutouts.color.mixed')).toBeInTheDocument();
  });

  it('presses nothing when the selected cutouts paint different surfaces', () => {
    renderWith([
      cutout({ id: 'a', color: '#ef4444', colorScope: 'floor' }),
      cutout({ id: 'b', color: '#ef4444', colorScope: 'floorAndWalls' }),
    ]);

    expect(pressed()).toEqual([]);
  });

  it('Off removes the color', () => {
    renderWith([cutout({ color: '#ef4444', colorScope: 'floorAndWalls' })]);

    fireEvent.click(segment('off'));

    expect(stored().color).toBeUndefined();
  });

  it('leaves a locked cutout alone', () => {
    renderWith([cutout()], true);

    fireEvent.click(segment('floor'));

    expect(stored().color).toBeUndefined();
  });
});
