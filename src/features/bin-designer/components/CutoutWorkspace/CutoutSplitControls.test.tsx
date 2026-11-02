import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutSplitControls } from './CutoutSplitControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const SPLIT = { a: { x: 0, y: -10 }, b: { x: 0, y: 10 }, cutDepth: 4 };

function cut(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c',
    shape: 'rectangle',
    x: 20,
    y: 30,
    width: 40,
    depth: 20,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function renderControls(cutout: Cutout, drawing = false) {
  const onDraw = vi.fn();
  const onChange = vi.fn();
  render(
    <CutoutSplitControls
      cutout={cutout}
      maxCutDepth={16.25}
      drawing={drawing}
      onDraw={onDraw}
      onChange={onChange}
    />
  );
  return { onDraw, onChange };
}

const button = (key: string) =>
  screen.getByRole('button', { name: `binDesigner.cutouts.split.${key}` });

describe('CutoutSplitControls', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('starts drawing a line on a plain pocket', () => {
    const { onDraw } = renderControls(cut());
    fireEvent.click(button('add'));
    expect(onDraw).toHaveBeenCalledOnce();
    expect(screen.getByText('binDesigner.cutouts.split.addHint')).toBeInTheDocument();
  });

  it('offers to stop while a line is being drawn', () => {
    renderControls(cut(), true);
    expect(button('cancel')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('binDesigner.cutouts.split.drawHint')).toBeInTheDocument();
  });

  it('says why a leaning pocket cannot be split', () => {
    renderControls(cut({ leanDeg: 10 }));
    expect(button('add')).toBeDisabled();
    expect(screen.getByText('binDesigner.cutouts.split.blocked.tilt')).toBeInTheDocument();
  });

  it('shows nothing for a shape that has no floor to split', () => {
    const { container } = render(
      <CutoutSplitControls
        cutout={cut({ shape: 'text' })}
        maxCutDepth={16.25}
        drawing={false}
        onDraw={vi.fn()}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("edits side B's depth inside the split, never offering a through cut", () => {
    const { onChange } = renderControls(cut({ split: SPLIT }));
    expect(
      screen.queryByRole('button', { name: 'binDesigner.cutouts.depthMode.through' })
    ).toBeNull();
    const field = screen.getByLabelText('binDesigner.cutouts.split.sideBDepth');
    fireEvent.change(field, { target: { value: '6' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenLastCalledWith({ ...SPLIT, cutDepth: 6 });
  });

  it('holds side B to a floor', () => {
    const { onChange } = renderControls(cut({ split: SPLIT }));
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutouts.depthMode.floor' }));
    const next = onChange.mock.lastCall?.[0] as typeof SPLIT & { depthMode?: string };
    expect(next.depthMode).toBe('floor');
    expect(next.a).toEqual(SPLIT.a);
  });

  it('redraws and removes a split', () => {
    const { onDraw, onChange } = renderControls(cut({ split: SPLIT }));
    fireEvent.click(button('redraw'));
    expect(onDraw).toHaveBeenCalledOnce();
    fireEvent.click(button('remove'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('warns that a split is paused while the pocket cuts through', () => {
    renderControls(cut({ split: SPLIT, depthMode: 'through' }));
    expect(screen.getByRole('alert')).toHaveTextContent('binDesigner.cutouts.split.paused.through');
  });
});
