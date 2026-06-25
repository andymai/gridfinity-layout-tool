import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompartmentSelectionEditor } from './CompartmentSelectionEditor';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { createUniformGrid } from '@/features/bin-designer/utils/compartments';

describe('CompartmentSelectionEditor', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: { ...createUniformGrid(2, 1, 1.2), compartmentTexts: ['BOLTS', ''] },
      },
    });
  });

  it('shows the selected compartment’s current label text', () => {
    render(<CompartmentSelectionEditor id={0} />);
    expect(screen.getByRole('textbox')).toHaveValue('BOLTS');
  });

  it('writes label edits through to the store', () => {
    render(<CompartmentSelectionEditor id={1} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'NUTS' } });
    expect(useDesignerStore.getState().params.compartments.compartmentTexts?.[1]).toBe('NUTS');
  });
});
