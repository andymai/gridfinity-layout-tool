import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitOptionsSection } from './SplitOptionsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('SplitOptionsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        defaultPrintBedSize: 256,
        defaultGridUnitMm: 42,
        defaultHeightUnitMm: 7,
      },
    });
  });

  it('returns null when bin fits on print bed', () => {
    const { container } = render(<SplitOptionsSection />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when bin exceeds print bed', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
    });

    render(<SplitOptionsSection />);
    expect(screen.getByText('Alignment connectors')).toBeInTheDocument();
  });

  it('shows split axis info', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3, height: 3 },
    });

    render(<SplitOptionsSection />);
    expect(screen.getByText(/width.*2 pieces/)).toBeInTheDocument();
  });

  it('toggles alignment connectors', async () => {
    const user = userEvent.setup();
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
    });

    render(<SplitOptionsSection />);
    await user.click(screen.getByRole('switch', { name: 'Alignment connectors' }));

    expect(useDesignerStore.getState().params.splitConnectors?.enabled).toBe(false);
  });

  it('shows only the toggle, no parameter controls', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
    });

    render(<SplitOptionsSection />);
    expect(screen.getByText('Alignment connectors')).toBeInTheDocument();
    // No individual parameter inputs exposed
    expect(screen.queryByText('Fit clearance')).not.toBeInTheDocument();
    expect(screen.queryByText('Tongue width')).not.toBeInTheDocument();
    expect(screen.queryByText('Tongue depth')).not.toBeInTheDocument();
  });
});
