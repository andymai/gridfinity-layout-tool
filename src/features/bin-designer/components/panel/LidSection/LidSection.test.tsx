import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { LidSection } from './LidSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

function resetStore(overrides: Partial<typeof DEFAULT_BIN_PARAMS> = {}) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, ...overrides },
    ui: { ...DEFAULT_UI_STATE },
  });
}

const ENABLE = 'Lid';

describe('LidSection', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders the master enable toggle', () => {
    render(<LidSection />);
    expect(screen.getByRole('switch', { name: ENABLE })).toBeInTheDocument();
  });

  it('disables the enable toggle when stacking lip is off', () => {
    resetStore({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } });
    render(<LidSection />);
    expect(screen.getByText('Requires stacking lip')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: ENABLE })).toBeDisabled();
  });

  it('toggles lid enabled', () => {
    render(<LidSection />);
    fireEvent.click(screen.getByRole('switch', { name: ENABLE }));
    expect(useDesignerStore.getState().params.lid.enabled).toBe(true);
  });

  it('shows the grouped controls directly when enabled (no Customize click)', () => {
    resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
    render(<LidSection />);
    expect(screen.getByText('How it attaches')).toBeInTheDocument();
    expect(screen.getByText('Top surface')).toBeInTheDocument();
    // Attachment + top-surface pickers render as radiogroups.
    expect(screen.getByRole('radiogroup', { name: 'Attachment' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Top surface' })).toBeInTheDocument();
  });

  it('auto-syncs magnetHoles + stackableTop on enable when bin has magnets', () => {
    resetStore({ base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('switch', { name: ENABLE }));
    const lid = useDesignerStore.getState().params.lid;
    expect(lid.magnetHoles).toBe(true);
    expect(lid.stackableTop).toBe(true);
  });

  it('leaves magnetHoles off on enable when bin has no magnets', () => {
    render(<LidSection />);
    fireEvent.click(screen.getByRole('switch', { name: ENABLE }));
    expect(useDesignerStore.getState().params.lid.magnetHoles).toBe(false);
  });

  describe('attachment picker', () => {
    it('switches attachment via the segmented control', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Magnetic' }));
      expect(useDesignerStore.getState().params.lid.attachment).toBe('magnetic');
    });

    it('seeds a thumb lift opposite the hinge on the first switch to hinged', () => {
      // A hinged lid must have somewhere to get a finger under, and the default
      // grip is `none` — so out of the box it would be a flush plate with
      // nothing to lift. Seeded once, from the geometry that already builds
      // exactly this.
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Hinged' }));
      const { lid } = useDesignerStore.getState().params;
      expect(lid.attachment).toBe('hinge');
      expect(lid.grip.mode).toBe('scallop');
      // Hinge defaults to the back wall, so the lift belongs on the front.
      expect(lid.grip.sides).toEqual({ front: true, back: false, left: false, right: false });
      expect(lid.grip.binDip).toBe(true);
    });

    it('never overwrites a grip the user has already configured', () => {
      // Silently rewriting a part nobody asked about is the line the sliding
      // lid's flush placement also refuses to cross: it reports a blocker
      // rather than turning the stacking lip off for you.
      resetStore({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          grip: {
            ...DEFAULT_BIN_PARAMS.lid.grip,
            mode: 'chamfer',
            sides: { front: false, back: false, left: true, right: false },
          },
        },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Hinged' }));
      const { lid } = useDesignerStore.getState().params;
      expect(lid.attachment).toBe('hinge');
      expect(lid.grip.mode).toBe('chamfer');
      expect(lid.grip.sides.left).toBe(true);
    });

    it('shows per-side rail chips only in click-rails mode', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'clickRails' },
      });
      render(<LidSection />);
      expect(screen.getByRole('switch', { name: 'Back' })).toBeInTheDocument();
    });

    it('hides per-side rail chips in friction mode', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'friction' },
      });
      render(<LidSection />);
      expect(screen.queryByRole('switch', { name: 'Back' })).not.toBeInTheDocument();
    });

    it('reveals magnet dimensions under Advanced in magnetic mode', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic' },
      });
      render(<LidSection />);
      // Collapsed by default.
      expect(
        screen.queryByRole('spinbutton', { name: 'Retention magnet diameter in millimeters' })
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Fine tuning' }));
      expect(
        screen.getByRole('spinbutton', { name: 'Retention magnet diameter in millimeters' })
      ).toBeInTheDocument();
    });
  });

  describe('lid thickness (#2761)', () => {
    it('commits a typed thickness to lid.topThicknessMm', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Fine tuning' }));
      const input = screen.getByRole('spinbutton', {
        name: 'Lid top plate thickness in millimeters',
      });
      fireEvent.change(input, { target: { value: '1.8' } });
      fireEvent.blur(input);
      expect(useDesignerStore.getState().params.lid.topThicknessMm).toBeCloseTo(1.8, 6);
    });

    // 0.2 is not representable in binary, so stepping lands on values like
    // 2.4000000000000004 — which would persist into shared design JSON.
    it('persists a clean one-decimal value at every step', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Fine tuning' }));
      const input = screen.getByRole('spinbutton', {
        name: 'Lid top plate thickness in millimeters',
      });
      for (const typed of ['1.2', '2.4', '3.6', '4.4']) {
        fireEvent.change(input, { target: { value: typed } });
        fireEvent.blur(input);
        const stored = useDesignerStore.getState().params.lid.topThicknessMm;
        expect(stored).toBe(Number(typed));
        expect(String(stored)).toBe(typed);
      }
    });

    it('clamps an over-range thickness to the maximum', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Fine tuning' }));
      const input = screen.getByRole('spinbutton', {
        name: 'Lid top plate thickness in millimeters',
      });
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.blur(input);
      expect(useDesignerStore.getState().params.lid.topThicknessMm).toBe(5);
    });

    // The knob is a floor; a 2.5mm magnet pocket needs 3.1mm of plate. The
    // hint has to report what the worker will actually build, not the input.
    it('reports the raised plate when a magnet pocket needs more material', () => {
      resetStore({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          stackableTop: true,
          magnetHoles: true,
          topThicknessMm: 1.2,
        },
        base: { ...DEFAULT_BIN_PARAMS.base, magnetDepth: 2.5 },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Fine tuning' }));
      expect(screen.getByText(/Top is 3\.1mm here/)).toBeInTheDocument();
    });
  });

  // With a tray the field sets the floor under the recess, so the
  // overall plate is a derived number the user never typed. Spelling out the
  // arithmetic is what makes the knob legible.
  describe('tray thickness breakdown (#3072)', () => {
    function renderTrayLid(topThicknessMm: number) {
      resetStore({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          stackableTop: false,
          tray: { enabled: true, depthMm: 4, wallMm: 2 },
          topThicknessMm,
        },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Fine tuning' }));
    }

    it('breaks the plate into recess, floor and overall', () => {
      renderTrayLid(2.4);
      expect(screen.getByText('Tray recess depth')).toBeInTheDocument();
      expect(screen.getByText('Remaining tray floor')).toBeInTheDocument();
      expect(screen.getByText('Overall lid thickness')).toBeInTheDocument();
      expect(screen.getByText('4.0 mm')).toBeInTheDocument();
      expect(screen.getByText('2.4 mm')).toBeInTheDocument();
      expect(screen.getByText('6.4 mm')).toBeInTheDocument();
    });

    it('relabels the field as the tray floor it actually sets', () => {
      renderTrayLid(2.4);
      expect(
        screen.getByRole('spinbutton', {
          name: 'Material left under the tray recess, in millimeters',
        })
      ).toBeInTheDocument();
    });

    // The whole point of the breakdown is that the field and the geometry agree.
    // The field bound was 0.8 while LID_TRAY_FLOOR is 1.6, so a tray lid could
    // show "Tray floor 0.8" directly above "Remaining tray floor 1.6 mm".
    it('never shows a floor the geometry will not use', () => {
      renderTrayLid(0.8);
      const input = screen.getByRole('spinbutton', {
        name: 'Material left under the tray recess, in millimeters',
      });
      expect(input).toHaveValue(1.6);
      expect(screen.getByText('1.6 mm')).toBeInTheDocument();
      expect(screen.getByText('5.6 mm')).toBeInTheDocument();
    });

    it('clamps a typed floor up to the minimum the geometry enforces', () => {
      renderTrayLid(2.4);
      const input = screen.getByRole('spinbutton', {
        name: 'Material left under the tray recess, in millimeters',
      });
      fireEvent.change(input, { target: { value: '0.8' } });
      fireEvent.blur(input);
      expect(useDesignerStore.getState().params.lid.topThicknessMm).toBe(1.6);
    });

    // The field shows the resolver-clamped floor; stepping from the raw stored
    // value made the first click compute a number that clamped straight back to
    // what was already on screen, so the control looked dead.
    it('moves on the first step up from a design storing less than the minimum', async () => {
      vi.useFakeTimers();
      try {
        renderTrayLid(0.8);
        fireEvent.click(
          screen.getByLabelText('Increase Material left under the tray recess, in millimeters')
        );
        // The stepper commits deferred clicks on an idle timer.
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
        expect(useDesignerStore.getState().params.lid.topThicknessMm).toBe(1.8);
      } finally {
        vi.useRealTimers();
      }
    });

    it('shows no breakdown on a lid without a tray', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Fine tuning' }));
      expect(screen.queryByText('Overall lid thickness')).not.toBeInTheDocument();
    });
  });

  describe('magnetic fit relief (#2761)', () => {
    it('explains the extra clearance in magnetic mode', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic' },
      });
      render(<LidSection />);
      expect(screen.getByText(/0\.15mm smaller per side/)).toBeInTheDocument();
    });

    it('omits the explanation when the relief is not applied', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'friction' },
      });
      render(<LidSection />);
      expect(screen.queryByText(/smaller per side/)).not.toBeInTheDocument();
    });
  });

  describe('top surface picker', () => {
    it('selecting Stackable turns on stackableTop', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Stackable' }));
      expect(useDesignerStore.getState().params.lid.stackableTop).toBe(true);
    });

    it('selecting Flat clears stackableTop and its sub-options', () => {
      resetStore({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          stackableTop: true,
          stackLipOnly: true,
          magnetHoles: true,
          separateStackPlate: true,
        },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Flat' }));
      const lid = useDesignerStore.getState().params.lid;
      expect(lid.stackableTop).toBe(false);
      expect(lid.stackLipOnly).toBe(false);
      expect(lid.magnetHoles).toBe(false);
      expect(lid.separateStackPlate).toBe(false);
    });

    it('selecting Tray enables the tray and clears stackable state', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, magnetHoles: true },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Tray' }));
      const lid = useDesignerStore.getState().params.lid;
      expect(lid.tray.enabled).toBe(true);
      expect(lid.stackableTop).toBe(false);
      expect(lid.magnetHoles).toBe(false);
    });

    it('shows stackable sub-toggles only when Stackable is selected', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true } });
      render(<LidSection />);
      expect(screen.getByRole('switch', { name: 'Magnet pockets' })).toBeInTheDocument();
      expect(
        screen.getByRole('switch', { name: 'Separate baseplate (glue-on)' })
      ).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Stacking lip only' })).toBeInTheDocument();
    });

    it('hides stackable sub-toggles when top surface is flat', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: false } });
      render(<LidSection />);
      expect(screen.queryByRole('switch', { name: 'Magnet pockets' })).not.toBeInTheDocument();
    });

    it('toggles the separate baseplate and shows its hint', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'Separate baseplate (glue-on)' }));
      expect(useDesignerStore.getState().params.lid.separateStackPlate).toBe(true);
      expect(screen.getByText(/Glue it onto the lid/i)).toBeInTheDocument();
    });

    it('flags the lip-only toggle as a no-op on a single-cell lid (#2930)', () => {
      resetStore({
        width: 1,
        depth: 1,
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, stackLipOnly: true },
      });
      render(<LidSection />);
      expect(screen.getByText(/No effect at this size/i)).toBeInTheDocument();
      // The print note would be noise here — nothing changes at 1x1.
      expect(screen.queryByText(/prints upside down/i)).not.toBeInTheDocument();
    });

    it('points a multi-cell lip-only lid at the separate baseplate (#2930)', () => {
      resetStore({
        width: 3,
        depth: 2,
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, stackLipOnly: true },
      });
      render(<LidSection />);
      expect(screen.getByText(/prints upside down/i)).toBeInTheDocument();
      expect(screen.queryByText(/No effect at this size/i)).not.toBeInTheDocument();
    });

    it('drops the print note once the baseplate is split off (#2930)', () => {
      resetStore({
        width: 3,
        depth: 2,
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          stackableTop: true,
          stackLipOnly: true,
          separateStackPlate: true,
        },
      });
      render(<LidSection />);
      expect(screen.queryByText(/prints upside down/i)).not.toBeInTheDocument();
    });

    it('keeps lip-only off when an imported design had it set without a stack top', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: false, stackLipOnly: true },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Stackable' }));
      const lid = useDesignerStore.getState().params.lid;
      expect(lid.stackableTop).toBe(true);
      expect(lid.stackLipOnly).toBe(false);
    });

    it('toggles the lip-only stack top and swaps the hint (#2930)', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true } });
      render(<LidSection />);
      expect(screen.getByText(/full grid of sockets/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('switch', { name: 'Stacking lip only' }));
      expect(useDesignerStore.getState().params.lid.stackLipOnly).toBe(true);
      expect(screen.getByText(/One lip around the edge/i)).toBeInTheDocument();
    });

    it('reveals tray dimensions under Advanced when Tray is selected', () => {
      resetStore({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          tray: { enabled: true, depthMm: 4, wallMm: 2 },
        },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Fine tuning' }));
      expect(
        screen.getByRole('spinbutton', { name: 'Tray recess depth in millimeters' })
      ).toBeInTheDocument();
    });
  });

  describe('extra lid height', () => {
    it('renders the Extra lid height control directly when enabled', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      expect(screen.getByText('Extra lid height')).toBeInTheDocument();
      expect(
        screen.getByRole('spinbutton', { name: 'Extra lid height in millimeters' })
      ).toBeInTheDocument();
    });

    it('commits a typed value to lid.extraHeightMm', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      const input = screen.getByRole('spinbutton', { name: 'Extra lid height in millimeters' });
      fireEvent.change(input, { target: { value: '30' } });
      fireEvent.blur(input);
      expect(useDesignerStore.getState().params.lid.extraHeightMm).toBe(30);
    });

    it('clamps an over-range value to the maximum', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      const input = screen.getByRole('spinbutton', { name: 'Extra lid height in millimeters' });
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.blur(input);
      expect(useDesignerStore.getState().params.lid.extraHeightMm).toBe(100);
    });
  });

  describe('lid text (#2695)', () => {
    it('reveals the text input only after the toggle is switched on', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      expect(screen.getByText('Lid text')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Lid text' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('switch', { name: 'Lid text' }));
      expect(screen.getByRole('textbox', { name: 'Lid text' })).toBeInTheDocument();
    });

    it('opens expanded when the design already has lid text', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables' },
      });
      render(<LidSection />);
      expect(screen.getByRole('textbox', { name: 'Lid text' })).toBeInTheDocument();
    });

    it('commits the typed text to surfaceText.lidText on blur', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'Lid text' }));
      const input = screen.getByRole('textbox', { name: 'Lid text' });
      fireEvent.change(input, { target: { value: 'Cables' } });
      fireEvent.blur(input);
      expect(useDesignerStore.getState().params.surfaceText?.lidText).toBe('Cables');
    });

    it('clears lid text and collapses when toggled off', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables' },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'Lid text' }));
      expect(useDesignerStore.getState().params.surfaceText?.lidText).toBeUndefined();
      expect(screen.queryByRole('textbox', { name: 'Lid text' })).not.toBeInTheDocument();
    });

    it('collapses an opened-but-empty toggle when the active design switches', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'Lid text' }));
      expect(screen.getByRole('textbox', { name: 'Lid text' })).toBeInTheDocument();

      act(() => {
        useDesignerStore.setState({ currentDesignId: 'another-design' });
      });
      expect(screen.queryByRole('textbox', { name: 'Lid text' })).not.toBeInTheDocument();
    });

    it('shows the mode picker only when text is present', () => {
      resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
      const { unmount } = render(<LidSection />);
      expect(screen.queryByRole('radio', { name: 'Emboss' })).not.toBeInTheDocument();
      unmount();

      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables' },
      });
      render(<LidSection />);
      expect(screen.getByRole('radio', { name: 'Emboss' })).toBeInTheDocument();
    });

    it("picking a mode writes the LID's own style, leaving the walls alone", () => {
      // The control sits under the lid's caption and reads as being about the
      // lid. Pointing it at the shared style changed all four walls to emboss
      // because someone embossed their lid.
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables', walls: { front: 'Cables' } },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Emboss' }));
      const { surfaceText } = useDesignerStore.getState().params;
      expect(surfaceText?.lidStyle?.mode).toBe('emboss');
      expect(surfaceText?.style?.mode).toBeUndefined();
    });

    it('shows the stencil note in through-cut mode', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables', style: { mode: 'through-cut' } },
      });
      render(<LidSection />);
      expect(screen.getByText(/stencil/i)).toBeInTheDocument();
    });

    it('replaces the input with a reason under a full stack grid', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true },
      });
      render(<LidSection />);
      expect(screen.queryByRole('textbox', { name: 'Lid text' })).not.toBeInTheDocument();
      // Anchored on this hint's own opening: the lid-cutout hint names the same
      // condition, so `/full stack grid/` alone matches both and would not say
      // which reason rendered.
      expect(screen.getByText(/^Not available with a full stack grid/i)).toBeInTheDocument();
    });

    it('allows text on a lip-only stack top and says where it lands (#2930)', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, stackLipOnly: true },
        surfaceText: { lidText: 'Cables' },
      });
      render(<LidSection />);
      expect(screen.getByRole('textbox', { name: 'Lid text' })).toBeInTheDocument();
      expect(screen.queryByText(/full stack grid/i)).not.toBeInTheDocument();
      expect(screen.getByText(/recessed floor inside the lip/i)).toBeInTheDocument();
    });

    it('warns that embossed text blocks stacking on a lip-only top (#2930)', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, stackLipOnly: true },
        surfaceText: { lidText: 'Cables', style: { mode: 'emboss' } },
      });
      render(<LidSection />);
      expect(screen.getByText(/won’t seat flat/i)).toBeInTheDocument();
    });

    it('does not warn about embossed text on a plain flat top', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables', style: { mode: 'emboss' } },
      });
      render(<LidSection />);
      expect(screen.queryByText(/won’t seat flat/i)).not.toBeInTheDocument();
    });

    it('replaces the input with a reason for custom-shape (cellMask) bins', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        // Partial 2×2 half-cell mask on a 1×1 bin — one corner missing.
        cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
      });
      render(<LidSection />);
      expect(screen.queryByRole('textbox', { name: 'Lid text' })).not.toBeInTheDocument();
      expect(screen.getByText('Not available for custom-shape bins.')).toBeInTheDocument();
    });

    it('shows the tray-floor hint when the tray is active', () => {
      resetStore({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          tray: { ...DEFAULT_BIN_PARAMS.lid.tray, enabled: true },
        },
        surfaceText: { lidText: 'Cables' },
      });
      render(<LidSection />);
      expect(screen.getByText(/Text is placed on the tray floor/)).toBeInTheDocument();
    });
  });

  describe('compatibility issues', () => {
    it('offers no one-click Fix on the label-tabs warning', () => {
      // The button deleted every label on the bin. That was proportionate while
      // a tab cost the whole wall's rail; the rail is only
      // segmented around the tabs, so it offered to destroy user content to
      // recover part of one wall. The warning itself still shows.
      // `relieveInterior: false` because the warning belongs to the notching
      // path:'s relief on, the shelf sits below the rail band and
      // there is nothing to warn about.
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, relieveInterior: false },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      render(<LidSection />);
      const fixButtons = screen.queryAllByRole('button', { name: /^Fix:/ });
      expect(
        fixButtons.find((b) => b.getAttribute('aria-label')?.includes('Label tabs'))
      ).toBeUndefined();
      expect(screen.getByText(/Label tabs take the wall they hang from/)).toBeInTheDocument();
    });

    it('still offers a Fix on a warning that really blocks the lid', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          back: { ...DEFAULT_BIN_PARAMS.walls.back, enabled: true },
        },
      });
      render(<LidSection />);
      expect(screen.getAllByRole('button', { name: /^Fix:/ }).length).toBeGreaterThan(0);
    });

    it('disables the per-side rail toggle when a feature conflict takes the whole wall', () => {
      // A finger scoop rising into the rail band fills the pocket the bump
      // hooks along the entire wall it is built against, so that side really
      // is off — the one side-bearing warning left that means it.
      resetStore({
        height: 6,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 40 },
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, relieveInterior: false },
      });
      render(<LidSection />);
      const frontChip = screen.getByRole('switch', { name: 'Front' });
      expect(frontChip).toBeDisabled();
      expect(frontChip.getAttribute('title')).toMatch(/auto-disabled/i);
    });

    it('leaves the rail toggle live for a wall cutout, which only takes its own span', () => {
      // The builder segments the rail run around the opening, so a 70%-wide
      // window costs only its own span rather than the whole wall's retention.
      // The user's choice has to survive to be honoured.
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          back: { ...DEFAULT_BIN_PARAMS.walls.back, enabled: true },
        },
      });
      render(<LidSection />);
      expect(screen.getByRole('switch', { name: 'Back' })).not.toBeDisabled();
    });

    it('leaves the rail toggle live for label tabs, which only take part of the wall', () => {
      // The builder segments the rail run around the tabs, so the wall still
      // carries rails in the gaps and the user's choice has to survive to be
      // honoured.
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      render(<LidSection />);
      expect(screen.getByRole('switch', { name: 'Back' })).not.toBeDisabled();
    });
  });
});

describe('LidSection grip relief (#3272)', () => {
  function enabled(grip: Partial<(typeof DEFAULT_BIN_PARAMS)['lid']['grip']> = {}) {
    resetStore({
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        grip: { ...DEFAULT_BIN_PARAMS.lid.grip, ...grip },
      },
    });
  }

  beforeEach(() => enabled());

  it('starts with no relief, so an existing design is unchanged', () => {
    render(<LidSection />);
    expect(useDesignerStore.getState().params.lid.grip.mode).toBe('none');
    // The per-side toggles only appear once a mode is chosen.
    expect(screen.queryByText('Walls')).not.toBeInTheDocument();
  });

  it('selects a mode and reveals the side toggles', () => {
    render(<LidSection />);
    fireEvent.click(screen.getByRole('radio', { name: 'Scallop' }));
    expect(useDesignerStore.getState().params.lid.grip.mode).toBe('scallop');
    expect(screen.getByText('Walls')).toBeInTheDocument();
  });

  it('toggles a wall', () => {
    enabled({ mode: 'scallop' });
    render(<LidSection />);
    const gripWalls = screen.getByText('Walls').parentElement;
    const left = within(gripWalls as HTMLElement).getByRole('switch', { name: 'Left' });
    fireEvent.click(left);
    expect(useDesignerStore.getState().params.lid.grip.sides.left).toBe(true);
  });

  it('warns when the user turned every wall off', () => {
    enabled({ mode: 'scallop', sides: { front: false, back: false, left: false, right: false } });
    render(<LidSection />);
    expect(screen.getByText('Pick at least one wall for the relief.')).toBeInTheDocument();
  });

  it('reports the effective depth and height the clamp resolved', () => {
    enabled({ mode: 'scallop' });
    render(<LidSection />);
    // Digits, not `.*`: a loose pattern matches the un-substituted string too,
    // which is how `{{depth}}` shipped past this test in every locale.
    expect(screen.getByText(/Cuts \d+(\.\d+)?mm deep, \d+(\.\d+)?mm tall/)).toBeInTheDocument();
  });

  it('explains a clamp rather than leaving a shallow relief looking like a defect', () => {
    resetStore({
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        tray: { enabled: true, depthMm: 4, wallMm: 2 },
        grip: { ...DEFAULT_BIN_PARAMS.lid.grip, mode: 'scallop' },
      },
    });
    render(<LidSection />);
    expect(screen.getByText(/Limited by the tray wall/)).toBeInTheDocument();
  });

  it('disables the shadow line on a stackable top, which has no valid geometry', () => {
    resetStore({
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true },
    });
    render(<LidSection />);
    expect(screen.getByRole('radio', { name: 'Shadow line' })).toBeDisabled();
  });

  it('toggles the bin lip dip and states what it costs', () => {
    enabled({ mode: 'scallop' });
    render(<LidSection />);
    const dip = screen.getByRole('checkbox', { name: /dip the bin/i });
    fireEvent.click(dip);
    expect(useDesignerStore.getState().params.lid.grip.binDip).toBe(true);
    expect(screen.getByText(/nothing to locate against/)).toBeInTheDocument();
  });
});

describe('LidSection grip / stackable-top conflict (#3272)', () => {
  /**
   * A stored `reveal` on a stackable top is a state the geometry silently
   * drops AND the server rejects on share (`validateLidGrip`). The panel has
   * to clear it on the way in, not just disable the option.
   */
  it('clears a reveal when the top becomes stackable', () => {
    resetStore({
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        grip: { ...DEFAULT_BIN_PARAMS.lid.grip, mode: 'reveal' },
      },
    });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('radio', { name: 'Stackable' }));
    expect(useDesignerStore.getState().params.lid.grip.mode).toBe('none');
  });

  it('leaves the other modes alone when the top becomes stackable', () => {
    for (const mode of ['chamfer', 'scallop'] as const) {
      resetStore({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          grip: { ...DEFAULT_BIN_PARAMS.lid.grip, mode },
        },
      });
      const view = render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Stackable' }));
      expect(useDesignerStore.getState().params.lid.grip.mode).toBe(mode);
      view.unmount();
    }
  });
});

describe('LidSection lid cutouts', () => {
  const cutout = {
    id: 'c1',
    shape: 'rectangle' as const,
    x: 5,
    y: 5,
    width: 10,
    depth: 5,
    cutDepth: 1,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };

  it('opens the shared editor pointed at the lid, not the bin', () => {
    // The whole retargeting rests on this: one flag redirects every cutout action
    // (see `cutoutOwner`), so a button that forgot to pass 'lid' would silently
    // edit the bin's interior instead.
    resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('button', { name: /Cut holes in the lid/i }));
    const { ui } = useDesignerStore.getState();
    expect(ui.cutoutEditorOpen).toBe(true);
    expect(ui.cutoutTarget).toBe('lid');
  });

  it('reports how many holes the lid already carries', () => {
    resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, cutouts: [cutout] } });
    render(<LidSection />);
    expect(screen.getByRole('button', { name: 'Cut holes in the lid (1)' })).toBeInTheDocument();
  });

  it('disables the button when a full stack grid owns the top face', () => {
    resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true } });
    render(<LidSection />);
    expect(screen.getByRole('button', { name: /Cut holes in the lid/i })).toBeDisabled();
  });

  it('keeps the button live on a lip-only stack top', () => {
    // A lip-only grid leaves the recessed floor inside the lip as one clear face,
    // exactly as it does for lid text.
    resetStore({
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, stackLipOnly: true },
    });
    render(<LidSection />);
    expect(screen.getByRole('button', { name: /Cut holes in the lid/i })).toBeEnabled();
  });
});
