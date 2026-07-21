import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
