import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  it('heads each family of controls', () => {
    render(<BaseSection />);

    expect(screen.getByText('Body type')).toBeInTheDocument();
    expect(screen.getByText('Stacking')).toBeInTheDocument();
    expect(screen.getByText('Mounting')).toBeInTheDocument();
    expect(screen.getByText('Feet')).toBeInTheDocument();
    expect(screen.getByText('Floor')).toBeInTheDocument();
  });

  it('renders the base controls under them', () => {
    render(<BaseSection />);

    expect(screen.getByText('Magnet holes')).toBeInTheDocument();
    expect(screen.getByText('Screw holes')).toBeInTheDocument();
    expect(screen.getByText('Stacking lip')).toBeInTheDocument();
    expect(screen.getByText('Lightweight floor')).toBeInTheDocument();
  });

  describe('body type', () => {
    it('offers the archetypes as one exclusive choice', () => {
      render(<BaseSection />);

      const group = screen.getByRole('group', { name: 'Body type' });
      const cards = within(group).getAllByRole('button');
      const chosen = cards.filter((c) => c.getAttribute('aria-pressed') === 'true');

      expect(cards).toHaveLength(5);
      expect(chosen).toHaveLength(1);
    });

    it('switches the archetype on click', async () => {
      const user = userEvent.setup();
      render(<BaseSection />);

      await user.click(screen.getByText('Spacer'));

      expect(useDesignerStore.getState().params.base.spacer).toBe(true);
    });

    it("shows only the chosen archetype's own options", async () => {
      const user = userEvent.setup();
      render(<BaseSection />);

      // The tray's mating controls belong to the tray, not to a row trailing
      // the whole section.
      expect(screen.queryByLabelText('Attachment')).not.toBeInTheDocument();

      await user.click(screen.getByText('Lid base'));

      expect(screen.getByLabelText('Attachment')).toBeInTheDocument();
    });
  });

  describe('subsections that do not apply', () => {
    it('drops the Mounting and Feet controls on a flat base but keeps them named', () => {
      // A flat base has no socket to drill or stand a foot on. The controls go,
      // and nothing is concealed by that (the engine clears what it disables),
      // but the heading and a reason stay: a control that simply vanishes
      // between one body type and the next is the confusing version of hiding.
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
      });
      render(<BaseSection />);

      expect(screen.queryByRole('switch', { name: 'Magnet holes' })).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Half sockets' })).not.toBeInTheDocument();

      expect(screen.getByText('Mounting')).toBeInTheDocument();
      expect(screen.getByText('Feet')).toBeInTheDocument();
      expect(screen.getAllByText(/flat base/i).length).toBeGreaterThan(0);
    });

    it('drops the Mounting controls on a spacer, which has no floor to hold hardware', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, spacer: true } },
      });
      render(<BaseSection />);

      expect(screen.queryByRole('switch', { name: 'Magnet holes' })).not.toBeInTheDocument();
      expect(screen.getByText('Mounting')).toBeInTheDocument();
      expect(screen.getByText(/spacer has no floor to hold a magnet/i)).toBeInTheDocument();

      // A spacer still stands on feet, so that family keeps its controls.
      expect(screen.getByRole('switch', { name: 'Half sockets' })).toBeInTheDocument();
    });

    it('keeps every family on an ordinary bin', () => {
      render(<BaseSection />);

      expect(screen.getByText('Mounting')).toBeInTheDocument();
      expect(screen.getByText('Feet')).toBeInTheDocument();
      expect(screen.getByText('Floor')).toBeInTheDocument();
    });
  });

  describe('lightweight relief mode', () => {
    it('is hidden while the feature is off', () => {
      render(<BaseSection />);

      expect(screen.queryByLabelText('Lightweight mode')).not.toBeInTheDocument();
    });

    it('appears under the toggle once the feature is on', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true } },
      });
      render(<BaseSection />);

      expect(screen.getByLabelText('Lightweight mode')).toBeInTheDocument();
    });

    // The reachability guarantee, rebuilt: the mode used to sit outside the
    // toggle purely so a scooped bin could reach the underside relief that IS
    // allowed. Nesting it would have stranded that bin, so the blocked toggle
    // offers the way through instead.
    it('offers a way to the underside relief when the interior one is blocked', async () => {
      const user = userEvent.setup();
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, scoop: { enabled: true, radius: 'auto' } },
      });
      render(<BaseSection />);

      expect(screen.getByRole('switch', { name: 'Lightweight floor' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Use underside relief' }));

      const base = useDesignerStore.getState().params.base;
      expect(base.lightweight).toBe(true);
      expect(base.lightweightMode).toBe('underside');
      // The scoop the interior relief would have ruled out survives, which is
      // the whole point of reaching for the underside one.
      expect(useDesignerStore.getState().params.scoop.enabled).toBe(true);
    });

    it('offers no such action when nothing is blocking the feature', () => {
      render(<BaseSection />);

      expect(
        screen.queryByRole('button', { name: 'Use underside relief' })
      ).not.toBeInTheDocument();
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

    // Half sockets seat at either offset, so the lattice has nothing left to
    // decide. It goes away entirely and the reason moves to the control that
    // caused it, where the user can act on it.
    it('disappears when half sockets make it inert, explaining itself at the cause', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, footLatticeX: 'half' },
        },
      });
      render(<BaseSection />);

      expect(screen.queryByText(/Foot lattice/)).not.toBeInTheDocument();
      expect(screen.getByText(/Half sockets already seat at either offset/)).toBeInTheDocument();
    });

    // The other two causes are decided over in Shape, where there is no local
    // control to hang the reason off. Without a note here the control would
    // simply be missing, which is the confusing version of hiding it.
    it('still explains itself when the cause is a fractional bin, not half sockets', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, width: 2.5, depth: 2.5 },
      });
      render(<BaseSection />);

      expect(screen.queryByText(/Foot lattice/)).not.toBeInTheDocument();
      expect(screen.getByText(/A fractional axis keeps the on-grid lattice/)).toBeInTheDocument();
    });
  });
});
