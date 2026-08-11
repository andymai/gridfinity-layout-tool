import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoLabelBar } from './BentoLabelBar';
import type { CompartmentGridApi } from '../CompartmentEditor/useCompartmentGrid';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function makeGrid(labeling: Record<string, unknown>): CompartmentGridApi {
  return {
    labeling: {
      labelMode: false,
      canLabel: true,
      editingId: null,
      textOf: () => '',
      displayNumberOf: (id: number) => id + 1,
      setLabelMode: vi.fn(),
      selectCompartment: vi.fn(),
      commitText: vi.fn(),
      advance: vi.fn(),
      moveByGrid: vi.fn(),
      ...labeling,
    },
  } as unknown as CompartmentGridApi;
}

describe('BentoLabelBar', () => {
  it('renders nothing when the interior cannot carry labels', () => {
    const { container } = render(<BentoLabelBar grid={makeGrid({ canLabel: false })} />);

    expect(container.firstChild).toBeNull();
  });

  it('offers the dividers/labels switch', () => {
    render(<BentoLabelBar grid={makeGrid({})} />);

    expect(screen.getByText('binDesigner.compartmentEditor.modeDividers')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.compartmentEditor.modeLabels')).toBeInTheDocument();
  });

  it('turns label mode on', () => {
    const setLabelMode = vi.fn();
    render(<BentoLabelBar grid={makeGrid({ setLabelMode })} />);

    fireEvent.click(screen.getByText('binDesigner.compartmentEditor.modeLabels'));

    expect(setLabelMode).toHaveBeenCalledWith(true);
  });

  it('prompts for a compartment before showing a field', () => {
    render(<BentoLabelBar grid={makeGrid({ labelMode: true, editingId: null })} />);

    expect(screen.getByText('binDesigner.compartmentEditor.clickToLabel')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('edits the focused compartment through the shared store action', () => {
    const commitText = vi.fn();
    render(<BentoLabelBar grid={makeGrid({ labelMode: true, editingId: 2, commitText })} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Bits' } });

    expect(commitText).toHaveBeenCalledWith(2, 'Bits');
  });

  it('moves to the next compartment on Enter', () => {
    const advance = vi.fn();
    render(<BentoLabelBar grid={makeGrid({ labelMode: true, editingId: 0, advance })} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(advance).toHaveBeenCalledWith('next');
  });

  it('moves back on Shift+Enter', () => {
    const advance = vi.fn();
    render(<BentoLabelBar grid={makeGrid({ labelMode: true, editingId: 1, advance })} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });

    expect(advance).toHaveBeenCalledWith('prev');
  });

  it('focuses the field so a whole tray can be labelled from the keyboard', () => {
    render(<BentoLabelBar grid={makeGrid({ labelMode: true, editingId: 0 })} />);

    expect(screen.getByRole('textbox')).toBe(document.activeElement);
  });
});
