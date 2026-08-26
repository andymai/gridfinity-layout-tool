import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DimensionsSection } from './DimensionsSection';
import { useLayoutStore } from '@/core/store/layout';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { gridUnits, mm, effectiveGridUnitMmY } from '@/core/types';
import { createTestBin, resetAllStores } from '@/test/testUtils';
import { drawerFrameOverhang } from '@/shared/utils/outlineFrame';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('DimensionsSection', () => {
  beforeEach(() => {
    resetAllStores();
    useToastStore.setState({ toasts: [] });
    useHalfGridModeStore.getState().setHalfGridMode(false);
  });

  const toastMessages = (): string[] => useToastStore.getState().toasts.map((t) => t.message);

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

  //. Typing a physical drawer size must land the tightest grid that fits,
  // the same fit the layout's measured-drawer card offers. Snapping to whole
  // units while a half unit fits hands the user a plate 21mm short of the drawer
  // and buries the difference in padding.
  describe('mm entry', () => {
    function commitMm(widthMm: string, depthMm: string): void {
      fireEvent.click(screen.getByLabelText('baseplate.editDimensions'));
      fireEvent.change(screen.getByLabelText('baseplate.editDimensionsWidth'), {
        target: { value: widthMm },
      });
      const depth = screen.getByLabelText('baseplate.editDimensionsDepth');
      fireEvent.change(depth, { target: { value: depthMm } });
      fireEvent.keyDown(depth, { key: 'Enter' });
    }

    it('takes the half unit that fits instead of burying it in padding', () => {
      render(<DimensionsSection />);
      commitMm('423', '502');

      const params = useLayoutStore.getState().layout.baseplateParams;
      // 502 / 42 = 11.95 units: 11.5 fits, leaving 19mm rather than 40mm.
      expect(params?.baseplateDepth).toBe(11.5);
      expect(params?.paddingFront).toBeCloseTo(9.5, 2);
      expect(params?.paddingBack).toBeCloseTo(9.5, 2);
      // 423 / 42 = 10.07: no half unit fits, so width stays whole.
      expect(params?.baseplateWidth).toBe(10);
      expect(params?.paddingLeft).toBeCloseTo(1.5, 2);
    });

    it('turns half-grid mode on when the fit needs it', () => {
      expect(useHalfGridModeStore.getState().halfGridMode).toBe(false);
      render(<DimensionsSection />);
      commitMm('423', '502');
      expect(useHalfGridModeStore.getState().halfGridMode).toBe(true);
    });

    it('leaves half-grid mode alone when whole units already fit tightest', () => {
      render(<DimensionsSection />);
      commitMm('423', '465');

      const params = useLayoutStore.getState().layout.baseplateParams;
      expect(params?.baseplateDepth).toBe(11);
      expect(useHalfGridModeStore.getState().halfGridMode).toBe(false);
    });

    it('says so when the fit turns the mode on', () => {
      render(<DimensionsSection />);
      commitMm('423', '502');
      expect(toastMessages()).toContain('toast.halfBinModeAutoEnabled');
    });
  });

  //. mm entry turns half-grid mode on, and the plate page carries neither the
  // sidebar's toggle nor the H shortcut, so without this control the mode is
  // reachable but not reversible from the only page that sets it.
  describe('half-grid mode toggle', () => {
    const toggle = (): HTMLElement => screen.getByLabelText('sidebar.halfBinMode');

    /** A detached plate with explicit dimensions, as mm entry leaves one. */
    function detachedPlate(width: number, depth: number, padMm: number): void {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        syncWithLayout: false,
        baseplateWidth: gridUnits(width),
        baseplateDepth: gridUnits(depth),
        paddingLeft: mm(padMm),
        paddingRight: mm(padMm),
        paddingFront: mm(padMm),
        paddingBack: mm(padMm),
      });
    }

    /** Outer plate size in mm — the figure the user typed, which has to survive. */
    function footprint(): { w: number; d: number } {
      const { layout } = useLayoutStore.getState();
      const p = layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      const gridW = (p.baseplateWidth ?? layout.drawer.width) * layout.gridUnitMm;
      const gridD = (p.baseplateDepth ?? layout.drawer.depth) * effectiveGridUnitMmY(layout);
      return {
        w: gridW + p.paddingLeft + p.paddingRight,
        d: gridD + p.paddingFront + p.paddingBack,
      };
    }

    it('reflects the stored mode', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      render(<DimensionsSection />);
      expect(toggle()).toBeChecked();
    });

    it('turns the mode on', () => {
      render(<DimensionsSection />);
      fireEvent.click(toggle());
      expect(useHalfGridModeStore.getState().halfGridMode).toBe(true);
    });

    it('floors fractional dimensions and hands the millimetres back to padding', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      detachedPlate(11.5, 6.5, 9.5);
      render(<DimensionsSection />);
      const before = footprint();
      fireEvent.click(toggle());

      const params = useLayoutStore.getState().layout.baseplateParams;
      expect(useHalfGridModeStore.getState().halfGridMode).toBe(false);
      expect(params?.baseplateWidth).toBe(11);
      expect(params?.baseplateDepth).toBe(6);
      expect(params?.paddingLeft).toBeCloseTo(20, 2);
      expect(params?.paddingRight).toBeCloseTo(20, 2);
      expect(params?.paddingFront).toBeCloseTo(20, 2);
      expect(params?.paddingBack).toBeCloseTo(20, 2);
      expect(footprint()).toEqual(before);
    });

    it('leaves whole-unit dimensions and their padding untouched', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      detachedPlate(11, 6, 9.5);
      render(<DimensionsSection />);
      fireEvent.click(toggle());

      const params = useLayoutStore.getState().layout.baseplateParams;
      expect(params?.baseplateWidth).toBe(11);
      expect(params?.paddingLeft).toBeCloseTo(9.5, 2);
    });

    it('leaves a synced plate to the layout', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      render(<DimensionsSection />);
      fireEvent.click(toggle());

      const params = useLayoutStore.getState().layout.baseplateParams;
      expect(useHalfGridModeStore.getState().halfGridMode).toBe(false);
      expect(params?.baseplateWidth).toBeUndefined();
    });

    it('keeps the mode on and says why when fractional bins block it', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      useLayoutStore.setState((state) => ({
        layout: {
          ...state.layout,
          bins: [createTestBin({ width: gridUnits(1.5) })],
        },
      }));
      render(<DimensionsSection />);
      fireEvent.click(toggle());

      expect(useHalfGridModeStore.getState().halfGridMode).toBe(true);
      expect(toastMessages()).toContain('halfBinBlocked.message');
    });
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

  //. The control only makes sense against a perimeter, so it stays hidden
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

    // A large radius shapes the plate under stacking too: the rounded
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
  //. A drawer measured larger than the cells it was given still prints a
  // plate that spans it: the generator widens its slab by the frame overhang and
  // intersects it with the shape. The readout described the lattice instead, so a
  // 931 x 327mm drawer carrying a 21 x 7 grid reported 882 x 294mm.
  describe('shaped-plate readout', () => {
    /** The reporter's drawer: a 931 x 327mm pen outline over a 21 x 7 grid. */
    function measuredDrawer(): void {
      useLayoutStore.setState((state) => ({
        layout: {
          ...state.layout,
          drawer: {
            ...state.layout.drawer,
            width: gridUnits(21),
            depth: gridUnits(7),
            outline: {
              vertices: [
                { x: 0, y: 0 },
                { x: 931, y: 0 },
                { x: 931, y: 327 },
                { x: 672, y: 327 },
                { x: 672, y: 189 },
                { x: 273, y: 189 },
                { x: 273, y: 327 },
                { x: 0, y: 327 },
              ],
              authoring: { kind: 'pen' as const },
            },
          },
        },
      }));
    }

    const readout = () => screen.getByLabelText('baseplate.editDimensions');

    it('reports the shape the plate is cut to, not the bare cells', () => {
      measuredDrawer();
      render(<DimensionsSection />);
      expect(readout()).toHaveTextContent(/931\s*×\s*327\s*mm/);
      expect(screen.getByText('baseplate.inclShape')).toBeInTheDocument();
    });

    it('names padding too once both are in play', () => {
      measuredDrawer();
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({ ...current, paddingLeft: mm(10) });
      render(<DimensionsSection />);
      expect(readout()).toHaveTextContent(/941\s*×\s*327\s*mm/);
      expect(screen.getByText('baseplate.inclPaddingShape')).toBeInTheDocument();
    });

    it('keeps the plain grid + padding reading on an unshaped plate', () => {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({ ...current, paddingLeft: mm(10) });
      render(<DimensionsSection />);
      expect(screen.getByText('baseplate.inclPadding')).toBeInTheDocument();
      expect(screen.queryByText('baseplate.inclShape')).not.toBeInTheDocument();
    });

    // Opening the field and clicking away is not an edit: committing it would
    // snap to a grid and drop both the sync and the shape.
    it('leaves the plate alone when the readout is opened and dismissed', () => {
      measuredDrawer();
      render(<DimensionsSection />);
      fireEvent.click(readout());
      fireEvent.blur(screen.getByLabelText('baseplate.editDimensionsDepth'), {
        relatedTarget: document.body,
      });
      expect(useLayoutStore.getState().layout.baseplateParams?.syncWithLayout).not.toBe(false);
    });
    //. Padding cannot express where the lattice sits inside a synced shape:
    // the outer size comes from the drawer, so the slack between shape and cells
    // is the only thing left to distribute.
    describe('grid position', () => {
      const shiftX = () => screen.queryByRole('spinbutton', { name: /gridAlignment.shiftX/ });

      it('is absent on an unshaped plate', () => {
        render(<DimensionsSection />);
        expect(screen.queryByText('baseplate.gridPosition')).not.toBeInTheDocument();
        expect(shiftX()).not.toBeInTheDocument();
      });

      it('offers the grid shift once the drawer has a shape', () => {
        measuredDrawer();
        render(<DimensionsSection />);
        expect(screen.getByText('baseplate.gridPosition')).toBeInTheDocument();
        expect(shiftX()).toBeInTheDocument();
      });

      //. Reaching this drawer's left edge needs 24.5mm, past the half pitch
      // (21mm) the shift used to be bounded by — so corner alignment, the thing
      // the control exists for, was the one position it could not express.
      it('reaches the edge, and the readout keeps the shape size', () => {
        measuredDrawer();
        render(<DimensionsSection />);
        const input = shiftX();
        expect(input).not.toBeNull();
        if (input === null) return;

        fireEvent.change(input, { target: { value: '-24.5' } });
        fireEvent.blur(input);

        const layout = useLayoutStore.getState().layout;
        expect(layout.drawer.gridShiftX).toBe(-24.5);
        // Flush against the left edge, with the whole 49mm of slack on the right.
        const overhang = drawerFrameOverhang(
          layout.drawer,
          layout.baseplateParams,
          layout.gridUnitMm
        );
        expect(overhang.left).toBe(0);
        expect(overhang.right).toBeCloseTo(49, 9);
        // The plate is still cut to the shape, so its footprint is unchanged.
        expect(screen.getByLabelText('baseplate.editDimensions')).toHaveTextContent(
          /931\s*×\s*327\s*mm/
        );
      });

      it('leaves the half-pitch bound alone on a shape that fills its grid', () => {
        const { width, depth } = useLayoutStore.getState().layout.drawer;
        useLayoutStore.setState((state) => ({
          layout: {
            ...state.layout,
            drawer: {
              ...state.layout.drawer,
              outline: {
                vertices: [
                  { x: 0, y: 0 },
                  { x: width * 42, y: 0 },
                  { x: width * 42, y: (depth * 42) / 2 },
                  { x: 0, y: (depth * 42) / 2 },
                ],
              },
            },
          },
        }));
        render(<DimensionsSection />);
        const input = shiftX();
        expect(input).not.toBeNull();
        if (input === null) return;

        fireEvent.change(input, { target: { value: '-30' } });
        fireEvent.blur(input);

        expect(useLayoutStore.getState().layout.drawer.gridShiftX).toBe(-21);
      });

      it('disappears when the plate stops syncing with the layout', () => {
        measuredDrawer();
        const current =
          useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
        useLayoutStore.getState().setBaseplateParams({ ...current, syncWithLayout: false });
        render(<DimensionsSection />);
        // The section header is gated on the outline reaching the plate too.
        expect(screen.queryByText('baseplate.gridPosition')).not.toBeInTheDocument();
      });
    });
  });
});
