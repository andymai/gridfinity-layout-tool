import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverhangSection } from './OverhangSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import type { CellMask } from '@/shared/utils/cellMask';

describe('OverhangSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders the four per-side controls', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 0, right: 0, front: 0, back: 0, enabled: true },
      },
    });
    render(<OverhangSection />);
    expect(screen.getByText('Overhang')).toBeDefined();
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('Right')).toBeDefined();
    expect(screen.getByText('Front')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
  });

  it('treats a legacy non-zero overhang as enabled and reveals the controls', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, overhang: { left: 3, right: 0, front: 0, back: 2 } },
    });
    render(<OverhangSection />);
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
  });

  it('sets and clears the hovered side on pointer enter/leave', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 0, right: 0, front: 0, back: 0, enabled: true },
      },
    });
    render(<OverhangSection />);
    // React derives onMouseEnter/Leave from delegated mouseover/mouseout.
    const left = screen.getByText('Left');
    fireEvent.mouseOver(left);
    expect(useDesignerStore.getState().ui.hoveredOverhangSide).toBe('left');
    fireEvent.mouseOut(left);
    expect(useDesignerStore.getState().ui.hoveredOverhangSide).toBeNull();
  });

  it('does not target the feet region when there is no overhang', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 0, right: 0, front: 0, back: 0, enabled: true },
      },
    });
    render(<OverhangSection />);
    fireEvent.mouseOver(screen.getByText('Feet under overhang'));
    // Feet toggle is disabled without overhang → hover stays null.
    expect(useDesignerStore.getState().ui.hoveredOverhangSide).toBeNull();
  });

  it('targets the feet region when an overhang exists', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, overhang: { left: 0, right: 4, front: 0, back: 0 } },
    });
    render(<OverhangSection />);
    fireEvent.mouseOver(screen.getByText('Feet under overhang'));
    expect(useDesignerStore.getState().ui.hoveredOverhangSide).toBe('feet');
  });

  it('enabling the taper seeds per-side values from the overhang and clears feet', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, overhang: { left: 0, right: 8, front: 0, back: 0 } },
    });
    render(<OverhangSection />);
    fireEvent.click(screen.getByText('Taper walls'));
    const overhang = useDesignerStore.getState().params.overhang;
    expect(overhang?.taper?.enabled).toBe(true);
    expect(overhang?.taper?.right).toBe(8); // seeded to taper back to nominal
    expect(overhang?.feet).toBe(false); // mutually exclusive with feet
  });

  it('reveals the profile and taper-height controls when the taper is on', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: {
          left: 0,
          right: 8,
          front: 0,
          back: 0,
          taper: {
            enabled: true,
            profile: 'chamfer',
            bandHeight: 5,
            left: 0,
            right: 8,
            front: 0,
            back: 0,
          },
        },
      },
    });
    render(<OverhangSection />);
    expect(screen.getByRole('radio', { name: 'Chamfer' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Fillet' })).toBeDefined();
    expect(screen.getByText('Rises up')).toBeDefined();
  });

  it('separates the flare sides under their own heading and splits base from flare', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: {
          left: 0,
          right: 20,
          front: 0,
          back: 0,
          taper: {
            enabled: true,
            profile: 'chamfer',
            bandHeight: 5,
            left: 0,
            right: 8,
            front: 0,
            back: 0,
          },
        },
      },
    });
    render(<OverhangSection />);
    expect(screen.getByText('Flare, per side')).toBeDefined();
    // Stored 20mm at the rim is presented as 12mm of base plus 8mm of flare.
    expect(screen.getByRole('button', { name: /^Right/ }).textContent).toBe('12');
    expect(screen.getByRole('button', { name: /Flare Right/ }).textContent).toBe('8');
    // Distinct from the overhang control of the same visible name above it.
    expect(screen.getByRole('slider', { name: 'Right' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Flare Right' })).toBeDefined();
  });

  it('adds flare on top of the base rather than eating into it (#2933)', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: {
          left: 0,
          right: 19.5,
          front: 0,
          back: 0,
          taper: {
            enabled: true,
            profile: 'chamfer',
            bandHeight: 40,
            left: 0,
            right: 0,
            front: 0,
            back: 0,
          },
        },
      },
    });
    render(<OverhangSection />);
    fireEvent.change(screen.getByRole('slider', { name: 'Flare Right' }), {
      target: { value: '20' },
    });
    const stored = useDesignerStore.getState().params.overhang;
    // Rim grows to base + flare; the base the user set is untouched.
    expect(stored?.right).toBe(39.5);
    expect(stored?.taper?.right).toBe(20);
  });

  it('allows flare on a side with no base overhang', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 0, right: 0, front: 0, back: 0, enabled: true },
      },
    });
    render(<OverhangSection />);
    fireEvent.click(screen.getByText('Taper walls'));
    expect(useDesignerStore.getState().params.overhang?.taper?.enabled).toBe(true);

    fireEvent.change(screen.getByRole('slider', { name: 'Flare Back' }), {
      target: { value: '15' },
    });
    const stored = useDesignerStore.getState().params.overhang;
    // Base stays at nominal, so the taper never cuts below the footprint.
    expect(stored?.back).toBe(15);
    expect(stored?.taper?.back).toBe(15);
  });

  it('holds the base steady when the taper is toggled off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: {
          left: 0,
          right: 39.5,
          front: 0,
          back: 0,
          taper: {
            enabled: true,
            profile: 'chamfer',
            bandHeight: 40,
            left: 0,
            right: 20,
            front: 0,
            back: 0,
          },
        },
      },
    });
    render(<OverhangSection />);
    fireEvent.click(screen.getByText('Taper walls'));
    const stored = useDesignerStore.getState().params.overhang;
    // Disabling sheds the flare instead of leaving a straight 39.5mm wall.
    expect(stored?.right).toBe(19.5);
    expect(stored?.taper?.enabled).toBe(false);
    // The dormant flare survives for re-enabling.
    expect(stored?.taper?.right).toBe(20);
  });

  it('keeps feet on when the taper is enabled (they compose)', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 0, right: 8, front: 0, back: 0, feet: true },
      },
    });
    render(<OverhangSection />);
    fireEvent.click(screen.getByText('Taper walls'));
    const stored = useDesignerStore.getState().params.overhang;
    expect(stored?.taper?.enabled).toBe(true);
    // Feet are framed from the base overhang, which the flare only widens above.
    expect(stored?.feet).toBe(true);
  });

  it('disables the taper for solid bins (hollow, single-compartment only)', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        overhang: { left: 8, right: 0, front: 0, back: 0 },
      },
    });
    render(<OverhangSection />);
    expect(
      screen.getByText('Taper is available only on hollow, single-compartment bins.')
    ).toBeDefined();
    fireEvent.click(screen.getByText('Taper walls'));
    expect(useDesignerStore.getState().params.overhang?.taper?.enabled).toBeFalsy();
  });

  it('disables the taper for multi-compartment bins', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
        overhang: { left: 8, right: 0, front: 0, back: 0 },
      },
    });
    render(<OverhangSection />);
    expect(
      screen.getByText('Taper is available only on hollow, single-compartment bins.')
    ).toBeDefined();
    fireEvent.click(screen.getByText('Taper walls'));
    expect(useDesignerStore.getState().params.overhang?.taper?.enabled).toBeFalsy();
  });

  it('disables the controls for custom-shape bins', () => {
    // 2×2 bin mask with one empty half-cell → partial (custom) shape.
    const mask: CellMask = {
      cols: 4,
      rows: 4,
      cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0] as (0 | 1)[],
    };
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, cellMask: mask },
    });
    render(<OverhangSection />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
