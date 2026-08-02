import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DimensionsSection } from './DimensionsSection';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { mm } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('DimensionsSection', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('renders the sync toggle, steppers, and padding controls', () => {
    render(<DimensionsSection />);
    expect(screen.getByLabelText('baseplate.syncWithLayout')).toBeInTheDocument();
    expect(screen.getByText('baseplate.gridWidth')).toBeInTheDocument();
    expect(screen.getByText('baseplate.gridDepth')).toBeInTheDocument();
    expect(screen.getByText('baseplate.padding')).toBeInTheDocument();
  });

  it('unchecking sync stores explicit dimensions copied from the drawer', () => {
    render(<DimensionsSection />);
    fireEvent.click(screen.getByLabelText('baseplate.syncWithLayout'));
    const params = useLayoutStore.getState().layout.baseplateParams;
    expect(params?.syncWithLayout).toBe(false);
    expect(params?.baseplateWidth).toBe(useLayoutStore.getState().layout.drawer.width);
    expect(params?.baseplateDepth).toBe(useLayoutStore.getState().layout.drawer.depth);
  });

  it('re-checking sync restores layout-driven dimensions', () => {
    render(<DimensionsSection />);
    const toggle = screen.getByLabelText('baseplate.syncWithLayout');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(useLayoutStore.getState().layout.baseplateParams?.syncWithLayout).toBe(true);
  });

  describe('margin seam connector style gate', () => {
    /** Padding above the detach threshold, so the connector row renders. */
    function detachablePlate(connectorStyle: 'dovetailKey' | 'snapClip' | 'puzzle'): void {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        paddingLeft: mm(12),
        paddingRight: mm(12),
        detachMargins: true,
        connectorNubs: true,
        connectorStyle,
      });
    }

    const connectorRow = () =>
      screen.getByRole('checkbox', { name: 'baseplate.detachMarginConnector' });
    const storedConnector = () =>
      useLayoutStore.getState().layout.baseplateParams?.detachMarginConnector;

    it('offers the connector for the puzzle key style (#2866)', () => {
      detachablePlate('dovetailKey');
      render(<DimensionsSection />);
      expect(screen.getByText('baseplate.detachMarginConnectorHint')).toBeInTheDocument();
      fireEvent.click(connectorRow());
      expect(storedConnector()).toBe(true);
    });

    it('still blocks it for the snap clip style', () => {
      // The top-insert clip has no seated form at a body↔rail seam.
      detachablePlate('snapClip');
      render(<DimensionsSection />);
      expect(connectorRow()).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('baseplate.detachMarginConnectorStyle')).toBeInTheDocument();
      fireEvent.click(connectorRow());
      expect(storedConnector()).toBeUndefined();
    });

    it('leaves the integral styles working', () => {
      detachablePlate('puzzle');
      render(<DimensionsSection />);
      fireEvent.click(connectorRow());
      expect(storedConnector()).toBe(true);
    });
  });

  // #3054. The control only makes sense against a perimeter, so it stays hidden
  // on a plain rectangle where no cell can be crossed.
  describe('whole-cell fitting', () => {
    /** An L-shaped drawer, which is what puts crossed cells on the plate. */
    function shapedDrawer(): void {
      const { width, depth } = useLayoutStore.getState().layout.drawer;
      const w = width * 42;
      const d = depth * 42;
      useLayoutStore.setState((state) => ({
        layout: {
          ...state.layout,
          drawer: {
            ...state.layout.drawer,
            outline: {
              vertices: [
                { x: 0, y: 0 },
                { x: w, y: 0 },
                { x: w, y: d / 2 },
                { x: w / 2, y: d / 2 },
                { x: w / 2, y: d },
                { x: 0, y: d },
              ],
            },
          },
        },
      }));
    }

    const row = () => screen.queryByRole('checkbox', { name: 'baseplate.wholeCellsOnly' });

    it('is hidden for a rectangular plate', () => {
      render(<DimensionsSection />);
      expect(row()).not.toBeInTheDocument();
    });

    // A radius past the plain-rounding limit becomes a radius-cut outline at
    // generation time, so those plates get a curved perimeter slicing sockets
    // even with no drawer shape — the control has to reach them.
    it('appears for a corner radius large enough to become an outline', () => {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({ ...current, cornerRadius: mm(40) });
      render(<DimensionsSection />);
      expect(row()).toBeInTheDocument();
    });

    it('stays hidden for a small radius the plain rounding path handles', () => {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({ ...current, cornerRadius: mm(4) });
      render(<DimensionsSection />);
      expect(row()).not.toBeInTheDocument();
    });

    // A large radius shapes the plate under stacking too (#3113): the rounded
    // perimeter survives and its tiles stack, so the whole-cell control must reach
    // them (the removed stacking override used to hide it).
    it('appears for a large radius even while stacking (#3113)', () => {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        cornerRadius: mm(40),
        stackPrint: { enabled: true, gapMm: mm(0.2) },
      });
      render(<DimensionsSection />);
      expect(row()).toBeInTheDocument();
    });

    it('appears once the drawer has a perimeter', () => {
      shapedDrawer();
      render(<DimensionsSection />);
      expect(row()).toBeInTheDocument();
    });

    it('stores undefined rather than false when turned back off', () => {
      shapedDrawer();
      render(<DimensionsSection />);
      const checkbox = row();
      expect(checkbox).not.toBeNull();
      if (checkbox === null) return;

      fireEvent.click(checkbox);
      expect(useLayoutStore.getState().layout.baseplateParams?.wholeCellsOnly).toBe(true);

      fireEvent.click(checkbox);
      // Undefined, not false: identical geometry keeps one stored identity.
      expect(useLayoutStore.getState().layout.baseplateParams?.wholeCellsOnly).toBeUndefined();
    });
  });
});
