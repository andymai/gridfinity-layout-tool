import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LidSection } from './LidSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

function resetStore(overrides: Partial<typeof DEFAULT_BIN_PARAMS> = {}) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, ...overrides },
    ui: { ...DEFAULT_UI_STATE },
  });
}

const ENABLE = 'Enable lid';

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
      fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
      expect(
        screen.getByRole('spinbutton', { name: 'Retention magnet diameter in millimeters' })
      ).toBeInTheDocument();
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
          magnetHoles: true,
          separateStackPlate: true,
        },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Flat' }));
      const lid = useDesignerStore.getState().params.lid;
      expect(lid.stackableTop).toBe(false);
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

    it('reveals tray dimensions under Advanced when Tray is selected', () => {
      resetStore({
        lid: {
          ...DEFAULT_BIN_PARAMS.lid,
          enabled: true,
          tray: { enabled: true, depthMm: 4, wallMm: 2 },
        },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
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

    it('picking a mode writes the shared surface-text style', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables' },
      });
      render(<LidSection />);
      fireEvent.click(screen.getByRole('radio', { name: 'Emboss' }));
      expect(useDesignerStore.getState().params.surfaceText?.style?.mode).toBe('emboss');
    });

    it('shows the stencil note in through-cut mode', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables', style: { mode: 'through-cut' } },
      });
      render(<LidSection />);
      expect(screen.getByText(/stencil/i)).toBeInTheDocument();
    });

    it('replaces the input with a reason when the top is stackable', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true },
      });
      render(<LidSection />);
      expect(screen.queryByRole('textbox', { name: 'Lid text' })).not.toBeInTheDocument();
      expect(screen.getByText(/stack grid owns/)).toBeInTheDocument();
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
      expect(screen.getByText(/tray floor/)).toBeInTheDocument();
    });
  });

  describe('compatibility issues', () => {
    it('shows a Fix button on the label-tabs warning that disables the feature', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      render(<LidSection />);
      const fixButtons = screen.getAllByRole('button', { name: /^Fix:/ });
      const labelFix = fixButtons.find((b) => b.getAttribute('aria-label')?.includes('Label tabs'));
      expect(labelFix).toBeDefined();
      fireEvent.click(labelFix!);
      expect(useDesignerStore.getState().params.label.enabled).toBe(false);
    });

    it('disables the per-side rail toggle when a feature conflict skips that side', () => {
      resetStore({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      render(<LidSection />);
      const backChip = screen.getByRole('switch', { name: 'Back' });
      expect(backChip).toBeDisabled();
      expect(backChip.getAttribute('title')).toMatch(/auto-disabled/i);
    });
  });
});
