import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompartmentLabelField } from './CompartmentLabelField';
import type { CompartmentLabeling } from './useCompartmentLabeling';

function makeLabeling(overrides: Partial<CompartmentLabeling> = {}): CompartmentLabeling {
  return {
    labelMode: true,
    canLabel: true,
    setLabelMode: vi.fn(),
    editingId: 0,
    selectCompartment: vi.fn(),
    orderedIds: [0, 1, 2],
    displayNumberOf: (id) => id + 1,
    textOf: () => '',
    commitText: vi.fn(),
    advance: vi.fn(),
    moveByGrid: vi.fn(),
    ...overrides,
  };
}

describe('CompartmentLabelField', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when no compartment is selected', () => {
    const { container } = render(
      <CompartmentLabelField labeling={makeLabeling({ editingId: null })} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the compartment number and its committed text', () => {
    render(<CompartmentLabelField labeling={makeLabeling({ textOf: () => 'M3' })} />);
    expect(screen.getByText('Comp. 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('M3')).toBeInTheDocument();
  });

  it('Enter commits the draft and advances to the next compartment', () => {
    const labeling = makeLabeling();
    render(<CompartmentLabelField labeling={labeling} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'BOLTS' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(labeling.commitText).toHaveBeenCalledWith(0, 'BOLTS');
    expect(labeling.advance).toHaveBeenCalledWith('next');
  });

  it('Shift+Enter advances to the previous compartment', () => {
    const labeling = makeLabeling();
    render(<CompartmentLabelField labeling={labeling} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(labeling.advance).toHaveBeenCalledWith('prev');
  });

  it('Tab commits and advances (keeps focus in the editor)', () => {
    const labeling = makeLabeling();
    render(<CompartmentLabelField labeling={labeling} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'NUTS' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(labeling.commitText).toHaveBeenCalledWith(0, 'NUTS');
    expect(labeling.advance).toHaveBeenCalledWith('next');
  });

  it('ArrowUp / ArrowDown navigate by grid position', () => {
    const labeling = makeLabeling();
    render(<CompartmentLabelField labeling={labeling} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(labeling.moveByGrid).toHaveBeenCalledWith('up');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(labeling.moveByGrid).toHaveBeenCalledWith('down');
  });

  it('ArrowRight navigates only when the caret is at the end of the text', () => {
    const labeling = makeLabeling({ textOf: () => 'AB' });
    render(<CompartmentLabelField labeling={labeling} />);
    const input = screen.getByRole<HTMLInputElement>('textbox');
    // caret at start → arrow moves within the text, no navigation
    input.setSelectionRange(0, 0);
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(labeling.moveByGrid).not.toHaveBeenCalled();
    // caret at end → navigates right
    input.setSelectionRange(2, 2);
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(labeling.moveByGrid).toHaveBeenCalledWith('right');
  });

  it('commits on blur', () => {
    const labeling = makeLabeling();
    render(<CompartmentLabelField labeling={labeling} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'WASHERS' } });
    fireEvent.blur(input);
    expect(labeling.commitText).toHaveBeenCalledWith(0, 'WASHERS');
  });

  it('flushes an uncommitted draft when the field unmounts (click-away within idle window)', () => {
    const labeling = makeLabeling();
    const { unmount } = render(<CompartmentLabelField labeling={labeling} />);
    const input = screen.getByRole('textbox');
    // Type without Enter/blur — only the 450ms idle timer is pending.
    fireEvent.change(input, { target: { value: 'PAINT' } });
    expect(labeling.commitText).not.toHaveBeenCalled();
    // Selecting another compartment unmounts this input (keyed by editingId).
    unmount();
    expect(labeling.commitText).toHaveBeenCalledWith(0, 'PAINT');
  });
});
