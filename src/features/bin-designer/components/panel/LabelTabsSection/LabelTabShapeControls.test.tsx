import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelTabShapeControls } from './LabelTabShapeControls';
import { useLabelTabsSection } from './useLabelTabsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

function Harness() {
  const { state, handlers, t } = useLabelTabsSection();
  return (
    <LabelTabShapeControls
      state={state}
      handlers={handlers}
      t={t}
      title="Tab shape & size"
      summary=""
      expanded
      onExpandedChange={() => {}}
    />
  );
}

describe('LabelTabShapeControls', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('offers the support styles and writes the chosen one to the design', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Support' });
    fireEvent.click(screen.getByRole('button', { name: 'Solid' }));
    expect(group).toBeInTheDocument();
    expect(useDesignerStore.getState().params.label.support).toBe('solid');
  });
});
