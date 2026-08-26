import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mm } from '@gridfinity/branded-types';
import { BaseSection } from './BaseSection';
import { useLayoutStore } from '@/core/store/layout';
import { useLabsStore } from '@/core/store';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import type { BaseplatePiece } from '../../types/tiling';
import type { ScrewHeadStyle } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { resetAllStores } from '@/test/testUtils';

/** Minimal exterior-front/back, join-shared-edge piece for a 2-col split row. */
function makePiece(
  overrides: Partial<BaseplatePiece> &
    Pick<
      BaseplatePiece,
      'label' | 'col' | 'row' | 'widthUnits' | 'depthUnits' | 'gridOffsetX' | 'gridOffsetY'
    >
): BaseplatePiece {
  return {
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'none',
    fractionalEdgeY: 'none',
    edges: { left: 'exterior', right: 'exterior', front: 'exterior', back: 'exterior' },
    placementRotationDeg: 0,
    ...overrides,
  };
}

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
    expect(screen.getByText('baseplate.cornerRadius')).toBeInTheDocument();
  });

  it('shows the corner-radius control while stacking, since a radius shapes the tiles (#3113)', () => {
    useLayoutStore.getState().setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      stackPrint: { enabled: true, copies: 2, gapMm: mm(0.2) },
    });
    render(<BaseSection />);
    expect(screen.getByText('baseplate.cornerRadius')).toBeInTheDocument();
    // Magnets are still stripped (and hidden) while stacking.
    expect(screen.queryByText('baseplate.magnetHoles')).not.toBeInTheDocument();
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
          makePiece({
            label: 'A1',
            col: 0,
            row: 0,
            widthUnits: 5,
            depthUnits: 4,
            gridOffsetX: 0,
            gridOffsetY: 0,
            edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'exterior' },
          }),
          makePiece({
            label: 'B1',
            col: 1,
            row: 0,
            widthUnits: 5,
            depthUnits: 4,
            gridOffsetX: 5,
            gridOffsetY: 0,
            edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
          }),
        ],
        margins: [],
        colSizes: [5, 5],
        rowSizes: [4],
        totalWidthUnits: 10,
        totalDepthUnits: 4,
        stackCount: 1,
        stackSeparatorThickness: 0,
        bedLoads: 1,
        paddingReductionHint: null,
        isCustomSplit: false,
        bedOverages: [],
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

  describe('mount-down screw holes (issue #3425)', () => {
    function enableScrews(headStyle: ScrewHeadStyle): void {
      useLayoutStore.getState().setBaseplateParams({
        ...DEFAULT_BASEPLATE_PARAMS,
        screwHoles: { enabled: true, diameter: mm(3.4), headStyle },
      });
    }

    it('offers the toggle', () => {
      render(<BaseSection />);
      expect(screen.getByText('baseplate.screwHoles.label')).toBeInTheDocument();
    });

    // The flag graduated, so a stored opt-out is dead state that
    // `isFeatureEnabled` short-circuits past. Reverting the status to
    // 'experimental' would hide the control again from anyone carrying this.
    it('offers the toggle even to a user carrying a stored opt-out', () => {
      useLabsStore.setState((s) => ({
        preferences: {
          ...s.preferences,
          enabledFeatures: { ...s.preferences.enabledFeatures, baseplate_screw_holes: false },
        },
      }));
      render(<BaseSection />);
      expect(screen.getByText('baseplate.screwHoles.label')).toBeInTheDocument();
    });

    it('hides the toggle while stacking, which strips the screws', () => {
      useLayoutStore.getState().setBaseplateParams({
        ...DEFAULT_BASEPLATE_PARAMS,
        stackPrint: { enabled: true, copies: 2, gapMm: mm(0.2) },
      });
      render(<BaseSection />);
      expect(screen.queryByText('baseplate.screwHoles.label')).not.toBeInTheDocument();
    });

    it('writes the defaults through to the layout store on toggle', () => {
      render(<BaseSection />);
      fireEvent.click(screen.getByRole('switch', { name: 'baseplate.screwHoles.label' }));
      expect(useLayoutStore.getState().layout.baseplateParams?.screwHoles).toEqual({
        enabled: true,
        diameter: 3.4,
        headStyle: 'countersink',
      });
    });

    it('adds the screw summary to the section header beside the magnet one', () => {
      useLayoutStore.getState().setBaseplateParams({
        ...DEFAULT_BASEPLATE_PARAMS,
        magnetHoles: true,
        screwHoles: { enabled: true, diameter: mm(3.4), headStyle: 'countersink' },
      });
      render(<BaseSection />);
      expect(
        screen.getByText(/ø6\.5mm × 2mm · baseplate\.screwHoles\.summary/)
      ).toBeInTheDocument();
    });

    it('shows the counterbore depth only for a counterbore head', () => {
      enableScrews('counterbore');
      render(<BaseSection />);
      expect(screen.getByText('baseplate.screwHoles.counterboreDepth.label')).toBeInTheDocument();
    });

    it('hides the counterbore depth for a countersink head, whose depth is derived', () => {
      enableScrews('countersink');
      render(<BaseSection />);
      expect(screen.getByText('baseplate.screwHoles.headDiameter.label')).toBeInTheDocument();
      expect(
        screen.queryByText('baseplate.screwHoles.counterboreDepth.label')
      ).not.toBeInTheDocument();
    });
  });

  it('renders nothing when stacking + unsplit + a drawn shape hides even the radius control', () => {
    useLayoutStore.getState().setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      stackPrint: { enabled: true, copies: 2, gapMm: mm(0.2) },
    });
    // A drawn outline makes the plate shaped, so the corner-radius control hides
    // too (the shape carries its own corners) — leaving the section empty.
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        drawer: {
          ...s.layout.drawer,
          outline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 80 },
              { x: 0, y: 80 },
            ],
          },
        },
      },
    }));
    const { container } = render(<BaseSection />);
    expect(container).toBeEmptyDOMElement();
  });
});
