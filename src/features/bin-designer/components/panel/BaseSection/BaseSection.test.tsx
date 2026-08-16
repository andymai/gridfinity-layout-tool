import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BaseSection } from './BaseSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('BaseSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders base toggles', () => {
    render(<BaseSection />);
    expect(screen.getByText('Magnet holes')).toBeInTheDocument();
    expect(screen.getByText('Screw holes')).toBeInTheDocument();
    expect(screen.getByText('Stacking lip')).toBeInTheDocument();
    expect(screen.getByText('Flat base (no socket)')).toBeInTheDocument();
    expect(screen.getByText('Lightweight floor')).toBeInTheDocument();
    expect(screen.getByText('Drainage holes')).toBeInTheDocument();
  });

  // The relief mode lives outside the Lightweight toggle so a bin blocked from
  // the interior mode can still reach the underside one — but it is a sub-option
  // of a feature most bins never enable, so it is folded away like the lattice.
  describe('lightweight mode disclosure', () => {
    it('is collapsed at the default', () => {
      render(<BaseSection />);
      expect(screen.getByText('Inside')).toBeInTheDocument();
      expect(screen.queryByLabelText('Lightweight mode')).not.toBeInTheDocument();
    });

    it('force-opens on the underside mode', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, lightweightMode: 'underside' },
        },
      });
      render(<BaseSection />);
      expect(screen.getByLabelText('Lightweight mode')).toBeInTheDocument();
    });

    // The reachability guarantee: the toggle is disabled by the scoop, and the
    // control that lifts that block is still on screen and still operable.
    it('stays reachable while the toggle it governs is disabled', async () => {
      const user = userEvent.setup();
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, scoop: { enabled: true, radius: 'auto' } },
      });
      render(<BaseSection />);
      expect(screen.getByRole('switch', { name: 'Lightweight floor' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: /Lightweight mode/ }));
      await user.click(screen.getByRole('radio', { name: 'Underside' }));

      expect(screen.getByRole('switch', { name: 'Lightweight floor' })).toBeEnabled();
    });
  });

  // The foot lattice is a power-user setting at its default on nearly every
  // bin, so it is folded away — but a wrong lattice leaves the bin perched on
  // the ridges between pockets, so a non-default value must never be the thing
  // that got hidden.
  describe('foot lattice disclosure', () => {
    it('is collapsed at the default, showing only the summary', () => {
      render(<BaseSection />);
      expect(screen.getByText('On grid / On grid')).toBeInTheDocument();
      expect(screen.queryByLabelText('Width axis')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Depth axis')).not.toBeInTheDocument();
    });

    it('opens on click', async () => {
      const user = userEvent.setup();
      render(<BaseSection />);
      await user.click(screen.getByRole('button', { name: /Foot lattice/ }));
      expect(screen.getByLabelText('Width axis')).toBeInTheDocument();
      expect(screen.getByLabelText('Depth axis')).toBeInTheDocument();
    });

    it('force-opens a non-default lattice rather than hiding it', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, footLatticeX: 'half' },
        },
      });
      render(<BaseSection />);
      expect(screen.getByLabelText('Width axis')).toBeInTheDocument();
      expect(screen.getByText('Half offset / On grid')).toBeInTheDocument();
    });

    // A stored value the lock overrides is not a customization — the summary
    // and the force-open both read the EFFECTIVE lattice, which is what the
    // part actually gets built with.
    it('stays collapsed when a stored lattice is overridden by half sockets', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, footLatticeX: 'half' },
        },
      });
      render(<BaseSection />);
      expect(screen.getByText('On grid / On grid')).toBeInTheDocument();
      expect(screen.queryByLabelText('Width axis')).not.toBeInTheDocument();
    });
  });

  it('reveals the hole picker only once drainage is on', () => {
    const { unmount } = render(<BaseSection />);
    expect(screen.queryByLabelText('Hole shape')).not.toBeInTheDocument();
    unmount();

    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        floorPattern: { enabled: true, pattern: 'round', scale: 0.5 },
      },
    });
    render(<BaseSection />);
    expect(screen.getByLabelText('Hole shape')).toBeInTheDocument();
  });

  it('disables drainage holes on a lightweight floor', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true },
      },
    });

    render(<BaseSection />);
    expect(screen.getByRole('switch', { name: 'Drainage holes' })).toBeDisabled();
  });

  it('disables magnet and screw toggles when flat floor is active', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      },
    });

    render(<BaseSection />);

    const magnetToggle = screen.getByRole('switch', { name: 'Magnet holes' });
    const screwToggle = screen.getByRole('switch', { name: 'Screw holes' });

    expect(magnetToggle).toBeDisabled();
    expect(screwToggle).toBeDisabled();
  });
});
