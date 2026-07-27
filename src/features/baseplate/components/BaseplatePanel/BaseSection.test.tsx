import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseSection } from './BaseSection';
import { useLayoutStore } from '@/core/store/layout';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('BaseSection', () => {
  beforeEach(() => {
    resetAllStores();
    // The baseplate page store is outside resetAllStores, so a tiling set by one
    // test would otherwise leak into the next and un-hide the connector picker.
    useBaseplatePageStore.getState().setTiling(null);
  });

  it('renders magnet, solid floor, and corner radius controls when not stacking', () => {
    render(<BaseSection />);
    expect(screen.getByText('baseplate.magnetHoles')).toBeInTheDocument();
    expect(screen.getByText('baseplate.solidFloor')).toBeInTheDocument();
  });

  it('toggling magnet holes writes through to the layout store', () => {
    render(<BaseSection />);
    const before =
      useLayoutStore.getState().layout.baseplateParams?.magnetHoles ??
      DEFAULT_BASEPLATE_PARAMS.magnetHoles;
    fireEvent.click(screen.getByRole('switch', { name: 'baseplate.magnetHoles' }));
    expect(useLayoutStore.getState().layout.baseplateParams?.magnetHoles).toBe(!before);
  });

  describe('all-edge slots (issue #2866)', () => {
    /** Minimal split tiling — enough for the connector picker to render. */
    function splitPlate(connectorStyle: 'dovetailKey' | 'snapClip' | 'puzzle'): void {
      useBaseplatePageStore.getState().setTiling({
        isSplit: true,
        cols: 2,
        rows: 1,
        pieces: [
          {
            label: 'A1',
            col: 0,
            row: 0,
            widthUnits: 5,
            depthUnits: 4,
            gridOffsetX: 0,
            gridOffsetY: 0,
            placementRotationDeg: 0,
          },
          {
            label: 'B1',
            col: 1,
            row: 0,
            widthUnits: 5,
            depthUnits: 4,
            gridOffsetX: 5,
            gridOffsetY: 0,
            placementRotationDeg: 0,
          },
        ],
        totalWidthUnits: 10,
        totalDepthUnits: 4,
        stackCount: 1,
        stackSeparatorThickness: 0,
        bedLoads: 1,
      });
      useLayoutStore.getState().setBaseplateParams({
        ...DEFAULT_BASEPLATE_PARAMS,
        connectorNubs: true,
        connectorStyle,
      });
    }

    it('offers the option for a both-female style', () => {
      splitPlate('dovetailKey');
      render(<BaseSection />);
      expect(screen.getByText('baseplate.connectorSlotsAllEdges')).toBeInTheDocument();
    });

    it('hides the option for an integral style', () => {
      // A tongue on an exterior edge would protrude past the drawer-facing wall.
      splitPlate('puzzle');
      render(<BaseSection />);
      expect(screen.queryByText('baseplate.connectorSlotsAllEdges')).not.toBeInTheDocument();
    });

    it('writes the flag through to the layout store', () => {
      splitPlate('snapClip');
      render(<BaseSection />);
      fireEvent.click(screen.getByRole('checkbox', { name: 'baseplate.connectorSlotsAllEdges' }));
      expect(useLayoutStore.getState().layout.baseplateParams?.connectorSlotsAllEdges).toBe(true);
    });
  });

  it('renders nothing when stacking hides every control and the plate is unsplit', () => {
    useLayoutStore.getState().setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      stackPrint: { enabled: true, copies: 2, gapMm: 0.2 },
    });
    const { container } = render(<BaseSection />);
    expect(container).toBeEmptyDOMElement();
  });
});
