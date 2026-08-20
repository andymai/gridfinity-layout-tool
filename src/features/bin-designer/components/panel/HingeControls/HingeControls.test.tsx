import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, renderHook, fireEvent } from '@testing-library/react';
import { HingeControls } from './HingeControls';
import { useLidSection } from '../LidSection/useLidSection';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_LID_HINGE_CONFIG } from '@/features/bin-designer/types/lid';
import type { BinParams, LidHingeConfig } from '@/features/bin-designer/types';

/**
 * Rendered against the REAL hook rather than a hand-built props object, for the
 * reason `SlideControls`' test gives: the pin readout is derived state, and a
 * stubbed `state` would assert against numbers this component never receives —
 * which is exactly the failure mode a readout quoting a length the barrel is
 * not bored for would have.
 *
 * `hinge` is left ABSENT by default, because that is what a design which has
 * never used a hinge actually carries (see `LidConfig.hinge`), so the component
 * has to render from the resolved fallback rather than a stored object.
 */
function renderControls(hinge?: Partial<LidHingeConfig>, over: Partial<BinParams> = {}) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      ...over,
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        attachment: 'hinge',
        ...(hinge ? { hinge: { ...DEFAULT_LID_HINGE_CONFIG, ...hinge } } : {}),
      },
    },
    ui: { ...DEFAULT_UI_STATE },
  });
  const { result } = renderHook(() => ({ lid: useLidSection(), t: useTranslation() }));
  render(
    <HingeControls
      state={result.current.lid.state}
      handlers={result.current.lid.handlers}
      t={result.current.t}
    />
  );
}

describe('HingeControls', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS, ui: { ...DEFAULT_UI_STATE } });
  });

  it('renders from the factory config when the design stores none', () => {
    renderControls();
    expect(screen.getByRole('radio', { name: 'Back' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Snap' })).toBeChecked();
  });

  it('writes the chosen wall through to the design', () => {
    renderControls();
    fireEvent.click(screen.getByRole('radio', { name: 'Left' }));
    expect(useDesignerStore.getState().params.lid.hinge?.side).toBe('left');
  });

  it('writes the chosen catch through to the design', () => {
    renderControls();
    fireEvent.click(screen.getByRole('radio', { name: 'Nothing' }));
    expect(useDesignerStore.getState().params.lid.hinge?.catchMode).toBe('none');
  });

  it('quotes a pin length, and one that tracks the bin', () => {
    // The pin is hardware the user cuts themselves, so this is the one number
    // nobody can measure off the model — and it is wrong the moment it stops
    // tracking the wall it is bored through.
    renderControls(undefined, { width: 3 });
    const wide = screen.getByText(/filament offcut, cut to/);
    const wideMm = Number(/cut to ([\d.]+) mm/.exec(wide.textContent ?? '')?.[1]);

    renderControls(undefined, { width: 5 });
    const wider = screen.getAllByText(/filament offcut, cut to/).at(-1);
    const widerMm = Number(/cut to ([\d.]+) mm/.exec(wider?.textContent ?? '')?.[1]);

    expect(wideMm).toBeGreaterThan(0);
    expect(widerMm).toBeGreaterThan(wideMm);
  });

  it('quotes one pin per run when a cutout splits the hinge wall', () => {
    // A cutout costs the barrel its own span, not its wall — so the wall keeps
    // a knuckle group either side, and each group takes its own pin. Saying
    // "1 pin" here would be wrong in the one case the segmentation exists for.
    const off = { ...DEFAULT_BIN_PARAMS.walls.left, enabled: false };
    renderControls(
      { side: 'back' },
      {
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: off,
          back: { ...off, enabled: true, width: 30, depth: 60 },
          left: off,
          right: off,
        },
      }
    );
    expect(screen.getByText(/filament offcuts/)).toBeInTheDocument();
  });

  it('explains what each catch costs, not just what it is', () => {
    // The three catches are a real trade — nothing, a snap that needs no
    // hardware, and magnets that hold hardest but have to be bought — and the
    // picker's labels alone do not carry it.
    renderControls({ catchMode: 'magnets' });
    expect(screen.getByText(/two magnets/)).toBeInTheDocument();

    renderControls({ catchMode: 'detent' });
    expect(screen.getAllByText(/no hardware/).at(-1)).toBeInTheDocument();
  });
});
