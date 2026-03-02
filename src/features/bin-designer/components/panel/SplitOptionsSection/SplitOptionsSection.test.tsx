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
    // Default print bed = 256mm -> maxGridUnits = 6
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        defaultPrintBedSize: 256,
        defaultGridUnitMm: 42,
      },
    });
  });

  it('returns null when bin fits on print bed', () => {
    // Default bin is 2x2 — fits on any reasonable bed
    const { container } = render(<SplitOptionsSection />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when bin exceeds print bed', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8, // Exceeds maxGridUnits of 6
        depth: 3,
      },
    });

    render(<SplitOptionsSection />);
    expect(screen.getByText('Alignment connectors')).toBeInTheDocument();
  });

  it('shows piece count info', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8,
        depth: 8,
      },
    });

    render(<SplitOptionsSection />);
    // 8x8 with maxGridUnits=6 -> 4 pieces
    expect(screen.getByText(/4 pieces/)).toBeInTheDocument();
  });

  it('toggles alignment connectors', async () => {
    const user = userEvent.setup();
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8,
        depth: 3,
      },
    });

    render(<SplitOptionsSection />);

    const toggle = screen.getByRole('switch', { name: 'Alignment connectors' });
    await user.click(toggle);

    const state = useDesignerStore.getState();
    expect(state.params.splitConnectors?.enabled).toBe(false);
  });

  it('renders assembled/exploded toggle', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8,
        depth: 3,
      },
    });

    render(<SplitOptionsSection />);
    expect(screen.getByText('Assembled')).toBeInTheDocument();
    expect(screen.getByText('Exploded')).toBeInTheDocument();
  });

  it('switches split view mode', async () => {
    const user = userEvent.setup();
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8,
        depth: 3,
      },
    });

    render(<SplitOptionsSection />);

    await user.click(screen.getByText('Assembled'));
    expect(useDesignerStore.getState().ui.splitViewMode).toBe('assembled');

    await user.click(screen.getByText('Exploded'));
    expect(useDesignerStore.getState().ui.splitViewMode).toBe('exploded');
  });
});
