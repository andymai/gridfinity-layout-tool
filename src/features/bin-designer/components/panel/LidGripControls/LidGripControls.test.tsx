import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, renderHook, fireEvent } from '@testing-library/react';
import { LidGripControls } from './LidGripControls';
import { useLidSection } from '../LidSection/useLidSection';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import type { LidGripConfig } from '@/features/bin-designer/types';

/**
 * Renders the controls against the REAL hook rather than a hand-built props
 * object: the clamp readouts are derived state, so a stubbed `state` would
 * assert against numbers this component never actually receives.
 */
function renderControls(grip: Partial<LidGripConfig> = {}) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        grip: { ...DEFAULT_BIN_PARAMS.lid.grip, ...grip },
      },
    },
    ui: { ...DEFAULT_UI_STATE },
  });
  const { result } = renderHook(() => ({ lid: useLidSection(), t: useTranslation() }));
  render(
    <LidGripControls
      state={result.current.lid.state}
      handlers={result.current.lid.handlers}
      t={result.current.t}
    />
  );
}

describe('LidGripControls', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS, ui: { ...DEFAULT_UI_STATE } });
  });

  it('offers every mode', () => {
    renderControls();
    for (const label of ['None', 'Chamfer', 'Shadow line', 'Scallop']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('shows nothing beyond the mode picker while the relief is off', () => {
    renderControls({ mode: 'none' });
    expect(screen.queryByText('Walls')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('switches mode through the handler', () => {
    renderControls({ mode: 'none' });
    fireEvent.click(screen.getByRole('radio', { name: 'Chamfer' }));
    expect(useDesignerStore.getState().params.lid.grip.mode).toBe('chamfer');
  });

  it('reports the depth and height the clamp actually resolved', () => {
    renderControls({ mode: 'scallop' });
    // Digits, not `.*`: a loose pattern matches the un-substituted string too.
    expect(screen.getByText(/Cuts \d+(\.\d+)?mm deep, \d+(\.\d+)?mm tall/)).toBeInTheDocument();
  });
});
