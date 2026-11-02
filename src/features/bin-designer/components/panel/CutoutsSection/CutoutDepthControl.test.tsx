import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutDepthControl } from './CutoutDepthControl';

function pocket(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'p1',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function renderControl(cutouts: readonly Cutout[]) {
  const onUpdate = vi.fn();
  render(
    <CutoutDepthControl
      cutouts={cutouts}
      maxCutDepth={16.25}
      onUpdate={onUpdate}
      disabled={false}
    />
  );
  return onUpdate;
}

const modeButton = (name: string) => screen.getByRole('button', { name });

// The default bin: 3u on a 4.75mm socket, 16.25mm of fill.
describe('CutoutDepthControl', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('offers the three modes with Fixed active for a plain pocket', () => {
    renderControl([pocket()]);
    expect(modeButton('Fixed')).toHaveAttribute('aria-pressed', 'true');
    expect(modeButton('To floor')).toHaveAttribute('aria-pressed', 'false');
    expect(modeButton('Through')).toBeEnabled();
    expect(screen.getByText('Cut depth')).toBeInTheDocument();
  });

  it('switches to the floor the pocket already has, so the cut does not move', () => {
    const onUpdate = renderControl([pocket()]);
    fireEvent.click(modeButton('To floor'));
    expect(onUpdate).toHaveBeenCalledWith(new Map([['p1', { depthMode: 'floor', floorMm: 16 }]]));
  });

  it('writes nothing when the active mode is picked again', () => {
    const onUpdate = renderControl([pocket()]);
    fireEvent.click(modeButton('Fixed'));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('clears the mode to go back to a fixed depth', () => {
    const onUpdate = renderControl([pocket({ depthMode: 'through', cutDepth: 16.25 })]);
    fireEvent.click(modeButton('Fixed'));
    expect(onUpdate).toHaveBeenCalledWith(new Map([['p1', { depthMode: undefined }]]));
  });

  it('shows the floor and the depth it leaves in floor mode', () => {
    renderControl([pocket({ depthMode: 'floor', floorMm: 8, cutDepth: 13 })]);
    expect(screen.getByText('Floor')).toBeInTheDocument();
    expect(screen.getByText('Cuts 13.0mm deep.')).toBeInTheDocument();
    expect(screen.queryByText('Cut depth')).not.toBeInTheDocument();
  });

  it('says where a through cut opens', () => {
    renderControl([pocket({ depthMode: 'through', cutDepth: 16.25 })]);
    expect(screen.getByText('Opens out of the bottom of the bin.')).toBeInTheDocument();
  });

  it('disables Through for a group member and says why', () => {
    renderControl([pocket({ groupId: 'g1' })]);
    expect(modeButton('Through')).toBeDisabled();
    expect(modeButton('Through')).toHaveAttribute('title', 'Ungroup it to cut through.');
  });

  it('warns when a through cut is set but cannot open', () => {
    renderControl([pocket({ depthMode: 'through', groupId: 'g1', cutDepth: 16.25 })]);
    expect(screen.getByRole('alert')).toHaveTextContent('Ungroup it to cut through.');
  });

  it('shows no active mode for a mixed selection and applies a pick to all', () => {
    const onUpdate = renderControl([pocket(), pocket({ id: 'p2', depthMode: 'through' })]);
    for (const name of ['Fixed', 'To floor', 'Through']) {
      expect(modeButton(name)).toHaveAttribute('aria-pressed', 'false');
    }
    fireEvent.click(modeButton('Through'));
    expect(onUpdate).toHaveBeenCalledWith(
      new Map([
        ['p1', { depthMode: 'through' }],
        ['p2', { depthMode: 'through' }],
      ])
    );
  });

  it('keeps a plain depth field for shapes whose depth has no mode', () => {
    renderControl([pocket({ shape: 'knifeSlot' })]);
    expect(screen.queryByRole('button', { name: 'Through' })).not.toBeInTheDocument();
    expect(screen.getByText('Cut depth')).toBeInTheDocument();
  });
});
