import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LabelTabsSection } from './LabelTabsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('LabelTabsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        // Tabs must be enabled for the engraved-text subsection to render.
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders label tabs toggle', () => {
    render(<LabelTabsSection />);
    expect(screen.getByText('Label tabs')).toBeInTheDocument();
  });

  it('renders one engraved-text input per compartment', () => {
    render(<LabelTabsSection />);
    expect(screen.getByLabelText('Engraved text for compartment 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Engraved text for compartment 2')).toBeInTheDocument();
  });

  it('writes typed text to the store via setCompartmentText', () => {
    render(<LabelTabsSection />);
    const input = screen.getByLabelText('Engraved text for compartment 1');
    fireEvent.change(input, { target: { value: 'SCREWS' } });
    expect(useDesignerStore.getState().params.compartments.compartmentTexts).toEqual(['SCREWS']);
  });

  it('exposes aria-pressed on the support picker reflecting the active option', () => {
    render(<LabelTabsSection />);
    // The pickers live inside the collapsed "Customize" disclosure.
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    // Default support is 'bracket'.
    expect(screen.getByRole('button', { name: 'Bracket', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solid', pressed: false })).toBeInTheDocument();
  });

  it('exposes aria-pressed on the alignment picker when it is visible', () => {
    // Alignment is hidden at full width; shrink the tab so the picker renders.
    useDesignerStore.setState((s) => ({
      params: { ...s.params, label: { ...s.params.label, width: 50, alignment: 'center' } },
    }));
    render(<LabelTabsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    expect(screen.getByRole('button', { name: 'Center', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Left', pressed: false })).toBeInTheDocument();
  });
});
