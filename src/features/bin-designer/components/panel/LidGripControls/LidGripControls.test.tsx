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

  it('reports the depth, height and remaining lid the clamp actually resolved', () => {
    renderControls({ mode: 'scallop' });
    // Digits, not `.*`: a loose pattern matches the un-substituted string too.
    expect(
      screen.getByText(
        /Cuts \d+(\.\d+)?mm deep, \d+(\.\d+)?mm tall, leaving \d+(\.\d+)?mm of lid above it/
      )
    ).toBeInTheDocument();
  });

  describe('height', () => {
    const field = () => screen.getByRole('spinbutton', { name: 'Height' });

    it('offers the height only where the mode has one', () => {
      renderControls({ mode: 'scallop' });
      expect(field()).toBeInTheDocument();
    });

    it('hides the height for a chamfer, whose section is its depth', () => {
      renderControls({ mode: 'chamfer' });
      expect(screen.queryByRole('spinbutton', { name: 'Height' })).not.toBeInTheDocument();
    });

    it('shows the mode request while the height is auto', () => {
      renderControls({ mode: 'scallop', heightMm: null });
      // The REQUEST (4mm), not the ~1.3mm a standard lid's skirt allows: the
      // field has to agree with what a user would type into it.
      expect(field()).toHaveValue(4);
    });

    it('commits a typed height to lid.grip.heightMm', () => {
      renderControls({ mode: 'scallop' });
      fireEvent.change(field(), { target: { value: '2.4' } });
      fireEvent.blur(field());
      expect(useDesignerStore.getState().params.lid.grip.heightMm).toBe(2.4);
    });

    it('clamps an over-range height to the maximum', () => {
      renderControls({ mode: 'scallop' });
      fireEvent.change(field(), { target: { value: '99' } });
      fireEvent.blur(field());
      expect(useDesignerStore.getState().params.lid.grip.heightMm).toBe(10);
    });

    it('offers a way back to auto only once a height is set', () => {
      renderControls({ mode: 'scallop', heightMm: null });
      expect(screen.queryByRole('button', { name: 'Auto' })).not.toBeInTheDocument();
    });

    it('returns the height to auto', () => {
      renderControls({ mode: 'scallop', heightMm: 2.4 });
      fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
      expect(useDesignerStore.getState().params.lid.grip.heightMm).toBeNull();
    });

    // A standard lid is a thin cap: the 4mm request cannot survive its skirt,
    // and a pocket half the height asked for reads as a defect unless the
    // panel says what ran out (#3272).
    it('explains a height the skirt cut short', () => {
      renderControls({ mode: 'scallop', heightMm: 10 });
      expect(screen.getByText(/Shortened to fit/)).toBeInTheDocument();
    });

    it('says nothing about the skirt when the height fits', () => {
      renderControls({ mode: 'scallop', heightMm: 0.8 });
      expect(screen.queryByText(/Shortened to fit/)).not.toBeInTheDocument();
    });
  });
});
