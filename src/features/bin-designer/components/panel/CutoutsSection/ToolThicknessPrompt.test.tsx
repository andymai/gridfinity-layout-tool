import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { ToolThicknessPrompt } from './ToolThicknessPrompt';

function pocket(id: string): Cutout {
  return {
    id,
    shape: 'path',
    x: 10,
    y: 10,
    width: 20,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}

function seed(ids: readonly string[]): void {
  const state = useDesignerStore.getInitialState();
  useDesignerStore.setState({
    ...state,
    params: { ...state.params, cutouts: ids.map(pocket) },
    ui: { ...state.ui, depthPromptIds: ids },
  });
}

const depthOf = (id: string) =>
  useDesignerStore.getState().params.cutouts.find((c) => c.id === id)?.cutDepth;

function answer(thickness: string, proud?: string): void {
  fireEvent.change(screen.getByLabelText('Thickness (mm)'), { target: { value: thickness } });
  if (proud !== undefined) {
    fireEvent.change(screen.getByLabelText('Sticks out (mm)'), { target: { value: proud } });
  }
}

// The default bin: 3u on a 4.75mm socket, 16.25mm of fill.
describe('ToolThicknessPrompt', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('renders nothing while nothing is queued', () => {
    const { container } = render(<ToolThicknessPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ignores queued ids whose cutouts are gone', () => {
    seed([]);
    useDesignerStore.getState().queueDepthPrompt(['gone']);
    const { container } = render(<ToolThicknessPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sets the depth so the tool sits flush and stops asking', () => {
    seed(['a']);
    render(<ToolThicknessPrompt />);
    expect(screen.getByText('How thick is this tool?')).toBeInTheDocument();
    answer('12');
    expect(screen.getByText('Cuts 12.0mm deep.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set depth' }));
    expect(depthOf('a')).toBe(12);
    expect(useDesignerStore.getState().ui.depthPromptIds).toEqual([]);
  });

  it('accepts a comma as the decimal mark and leaves the tool standing proud', () => {
    seed(['a']);
    render(<ToolThicknessPrompt />);
    answer('12,5', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Set depth' }));
    expect(depthOf('a')).toBe(10.5);
  });

  it('keeps Set depth off until the answer is a usable depth', () => {
    seed(['a']);
    render(<ToolThicknessPrompt />);
    const apply = screen.getByRole('button', { name: 'Set depth' });
    expect(apply).toBeDisabled();
    answer('2', '2');
    expect(apply).toBeDisabled();
  });

  it('offers a taller bin when the tool is too thick for this one', () => {
    seed(['a']);
    render(<ToolThicknessPrompt />);
    answer('20');
    expect(screen.getByRole('alert')).toHaveTextContent('This bin has room for 16.3mm.');
    expect(screen.getByRole('button', { name: 'Set depth' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Make the bin 4u tall' }));
    expect(useDesignerStore.getState().params.height).toBe(4);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set depth' })).toBeEnabled();
  });

  it('lets a too-thick tool through once it is set to stick out', () => {
    seed(['a']);
    render(<ToolThicknessPrompt />);
    answer('20', '4');
    fireEvent.click(screen.getByRole('button', { name: 'Set depth' }));
    expect(depthOf('a')).toBe(16);
  });

  it('answers every queued tool at once by default', () => {
    seed(['a', 'b']);
    const onFocusTools = vi.fn();
    render(<ToolThicknessPrompt onFocusTools={onFocusTools} />);
    expect(screen.getByText('How thick are these 2 tools?')).toBeInTheDocument();
    expect(onFocusTools).toHaveBeenCalledWith(['a', 'b']);
    answer('8');
    fireEvent.click(screen.getByRole('button', { name: 'Set depth' }));
    expect([depthOf('a'), depthOf('b')]).toEqual([8, 8]);
  });

  it('asks one tool at a time when the thicknesses differ', () => {
    seed(['a', 'b']);
    const onFocusTools = vi.fn();
    render(<ToolThicknessPrompt onFocusTools={onFocusTools} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Same thickness for all 2' }));
    expect(screen.getByText('How thick is this tool?')).toBeInTheDocument();
    expect(screen.getByText('2 left')).toBeInTheDocument();
    expect(onFocusTools).toHaveBeenLastCalledWith(['a']);
    answer('8');
    fireEvent.click(screen.getByRole('button', { name: 'Set depth' }));
    expect([depthOf('a'), depthOf('b')]).toEqual([8, 5]);
    expect(screen.getByText('1 left')).toBeInTheDocument();
    expect(onFocusTools).toHaveBeenLastCalledWith(['b']);
  });

  it('leaves the depth alone when skipped', () => {
    seed(['a']);
    render(<ToolThicknessPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(depthOf('a')).toBe(5);
    expect(useDesignerStore.getState().ui.depthPromptIds).toEqual([]);
  });

  it('stays away while the lid is the board', () => {
    seed(['a']);
    useDesignerStore.setState((s) => ({ ui: { ...s.ui, cutoutTarget: 'lid' } }));
    const { container } = render(<ToolThicknessPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('selects the asked-about tools once, not again on every render', () => {
    seed(['a']);
    const onFocusTools = vi.fn();
    const { rerender } = render(<ToolThicknessPrompt onFocusTools={onFocusTools} />);
    rerender(<ToolThicknessPrompt onFocusTools={vi.fn()} />);
    answer('8');
    expect(onFocusTools).toHaveBeenCalledTimes(1);
  });
});
