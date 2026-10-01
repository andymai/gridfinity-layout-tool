import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelTabTextStyleControls } from './LabelTabTextStyleControls';
import { useLabelTabsSection } from './useLabelTabsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

function Harness() {
  const { state, handlers, t } = useLabelTabsSection();
  return (
    <LabelTabTextStyleControls
      state={state}
      handlers={handlers}
      t={t}
      title="Engraved text"
      summary=""
      expanded
      onExpandedChange={() => {}}
    />
  );
}

describe('LabelTabTextStyleControls', () => {
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

  it('offers Flat only once the design prints in more than one color', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole('radio', { name: 'Flat' })).not.toBeInTheDocument();
    unmount();

    const { params } = useDesignerStore.getState();
    useDesignerStore.setState({
      params: { ...params, featureColors: { ...params.featureColors, enabled: true } },
    });
    render(<Harness />);
    expect(screen.getByLabelText('Text depth')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Flat' }));
    expect(useDesignerStore.getState().params.textDefaults.mode).toBe('flat');
    expect(screen.queryByLabelText('Text depth')).not.toBeInTheDocument();
  });

  it('sets the Text colour where Flat is chosen and fixes letters that would not show', () => {
    const { params } = useDesignerStore.getState();
    useDesignerStore.setState({
      params: {
        ...params,
        compartments: { ...params.compartments, compartmentTexts: ['BOLTS', ''] },
        textDefaults: { ...params.textDefaults, mode: 'flat' },
        featureColors: { ...params.featureColors, enabled: true },
      },
    });
    render(<Harness />);
    expect(screen.getByRole('button', { name: /^Text color:/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use a contrasting color' }));
    const { featureColors } = useDesignerStore.getState().params;
    expect(featureColors.text).not.toBe(featureColors.labelTab);
    expect(screen.queryByRole('button', { name: 'Use a contrasting color' })).toBeNull();
  });

  it('offers one click to turn on Multi-Color when Flat is kept without it', () => {
    const { params } = useDesignerStore.getState();
    useDesignerStore.setState({
      params: { ...params, textDefaults: { ...params.textDefaults, mode: 'flat' } },
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Multi-Color' }));
    expect(useDesignerStore.getState().params.featureColors.enabled).toBe(true);
  });

  it('offers the finishes and writes the chosen one to the text defaults', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Emboss' }));
    expect(useDesignerStore.getState().params.textDefaults.mode).toBe('emboss');
  });
});
