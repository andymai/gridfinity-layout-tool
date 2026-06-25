import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionEditor } from './SelectionEditor';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { createUniformGrid } from '@/features/bin-designer/utils/compartments';

describe('SelectionEditor', () => {
  beforeEach(() => {
    useSettingsStore.getState().updateSetting('angledDividersEnabled', false);
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, compartments: createUniformGrid(2, 1, 1.2) },
      ui: {
        ...useDesignerStore.getState().ui,
        selectedCompartmentId: null,
        selectedColorZone: null,
        selectedDividerKey: null,
      },
    });
  });

  it('renders nothing when no element is selected', () => {
    const { container } = render(<SelectionEditor />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the compartment arm and clears selection via the X button', () => {
    useDesignerStore.getState().setSelectedCompartmentId(1);
    render(<SelectionEditor />);
    // Compartment arm renders a label textbox.
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // The only button in compartment mode is the clear (X) affordance.
    fireEvent.click(screen.getByRole('button'));
    expect(useDesignerStore.getState().ui.selectedCompartmentId).toBeNull();
  });
});
