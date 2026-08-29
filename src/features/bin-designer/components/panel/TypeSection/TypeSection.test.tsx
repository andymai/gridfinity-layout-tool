import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypeSection } from './TypeSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { TEXT_PRESETS } from '@/features/bin-designer/types';

vi.mock('@/features/bin-designer/hooks/useTypeMeasurer', () => ({
  useTypeMeasurer: () => null,
}));

describe('TypeSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, textDefaults: TEXT_PRESETS.engineering },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('marks the preset the design is actually on', () => {
    render(<TypeSection />);
    expect(screen.getByRole('button', { name: /^Engineering/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('applies a preset when its card is picked', async () => {
    render(<TypeSection />);
    await userEvent.click(screen.getByRole('button', { name: /^Classic/ }));
    expect(useDesignerStore.getState().params.textDefaults).toEqual(TEXT_PRESETS.classic);
  });

  it('describes what the section governs', () => {
    render(<TypeSection />);
    expect(screen.getByText(/every caption on this bin/)).toBeInTheDocument();
  });

  it('offers the nine-point anchor grid', () => {
    render(<TypeSection />);
    // Scoped to the anchor's own group: the case and size-mode segmented
    // controls are radios too.
    const grid = screen.getByRole('radiogroup', { name: 'Position' });
    expect(within(grid).getAllByRole('radio')).toHaveLength(9);
  });

  it('shows the fixed-size control only in fixed mode', async () => {
    render(<TypeSection />);
    expect(screen.getByLabelText('Type size')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Fit to space' }));
    expect(screen.queryByLabelText('Type size')).toBeNull();
  });

  it('stays quiet about stem width until the worker reports a problem', () => {
    render(<TypeSection />);
    expect(screen.queryByText(/thinner than a nozzle/)).toBeNull();
  });
});
