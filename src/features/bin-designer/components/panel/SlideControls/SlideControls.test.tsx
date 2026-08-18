import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, renderHook, fireEvent } from '@testing-library/react';
import { SlideControls } from './SlideControls';
import { useLidSection } from '../LidSection/useLidSection';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_LID_SLIDE_CONFIG } from '@/features/bin-designer/types/lid';
import type { LidSlideConfig } from '@/features/bin-designer/types';

/**
 * Rendered against the REAL hook rather than a hand-built props object, for the
 * reason `LidGripControls`' test gives: the readouts are derived state, and a
 * stubbed `state` would assert against numbers this component never receives.
 *
 * `slide` is left ABSENT by default — that is what a design which has never
 * touched a sliding lid actually carries (see `LidConfig.slide`), so the
 * component has to render from the resolved fallback rather than from a stored
 * object.
 */
function renderControls(slide?: Partial<LidSlideConfig>) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        attachment: 'slide',
        ...(slide ? { slide: { ...DEFAULT_LID_SLIDE_CONFIG, ...slide } } : {}),
      },
    },
    ui: { ...DEFAULT_UI_STATE },
  });
  const { result } = renderHook(() => ({ lid: useLidSection(), t: useTranslation() }));
  render(
    <SlideControls
      state={result.current.lid.state}
      handlers={result.current.lid.handlers}
      t={result.current.t}
    />
  );
}

describe('SlideControls', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS, ui: { ...DEFAULT_UI_STATE } });
  });

  it('renders from the factory config when the design stores none', () => {
    renderControls();
    expect(screen.getByRole('radio', { name: 'Under the lip' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Front' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Finger notch' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Click shut' })).toBeChecked();
  });

  it('offers both placements and every pull', () => {
    renderControls();
    for (const label of ['Under the lip', 'At the rim']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    for (const label of ['None', 'Finger notch', 'Tab']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('offers all four entry walls', () => {
    renderControls();
    for (const label of ['Front', 'Back', 'Left', 'Right']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('writes a complete config on the first edit', () => {
    // The field starts absent, so the first change has to materialise the whole
    // object rather than a one-key partial — otherwise every other knob would
    // read back as undefined.
    renderControls();

    fireEvent.click(screen.getByRole('radio', { name: 'At the rim' }));

    const stored = useDesignerStore.getState().params.lid.slide;
    expect(stored).toEqual({
      placement: 'flush',
      entrySide: 'front',
      clearanceMm: 0.25,
      pull: 'notch',
      detent: true,
    });
  });

  it('changes the entry wall through the store', () => {
    renderControls();

    fireEvent.click(screen.getByRole('radio', { name: 'Right' }));

    expect(useDesignerStore.getState().params.lid.slide?.entrySide).toBe('right');
  });

  it('toggles the detent through the store', () => {
    renderControls({ detent: true });

    fireEvent.click(screen.getByRole('switch', { name: 'Click shut' }));

    expect(useDesignerStore.getState().params.lid.slide?.detent).toBe(false);
  });

  it('reports the unsupported span the sag advice is about', () => {
    renderControls();
    // A 3x2 bin entered from the front spans its width, so the readout is a
    // real number rather than a placeholder — the panel reads it off the plan.
    expect(screen.getByText(/Unsupported span: \d+\.\d mm/)).toBeInTheDocument();
  });
});
