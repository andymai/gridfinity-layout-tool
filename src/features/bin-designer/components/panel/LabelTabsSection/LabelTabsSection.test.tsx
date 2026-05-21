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
});
