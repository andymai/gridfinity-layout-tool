import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorModeContent } from './InteriorModes';
import { INTERIOR_MODE_META } from './interiorModeMeta';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';

vi.mock('./icons', () => ({
  Grid3x3Icon: () => <div data-testid="grid-icon" />,
  BentoIcon: () => <div data-testid="bento-icon" />,
  DividerIcon: () => <div data-testid="divider-icon" />,
  ScissorsIcon: () => <div data-testid="scissors-icon" />,
}));

// Mock child components
vi.mock('../../CompartmentEditor', () => ({
  CompartmentEditor: () => <div data-testid="compartment-editor" />,
}));
vi.mock('../../SlotConfigurator/SlotConfigurator', () => ({
  SlotConfigurator: () => <div data-testid="slot-configurator" />,
}));

// Mock i18n
vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const mocks = vi.hoisted(() => ({
  setBentoWorkspaceOpen: vi.fn(),
  setCutoutEditorOpen: vi.fn(),
  params: {} as BinParams,
}));

// Real DEFAULT_BIN_PARAMS rather than a hand-built stub: the solid mode asks the
// constraint engine about `cutouts`, and the engine reads across the whole
// params tree, so a partial fake answers a different question than the app does.
vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      params: mocks.params,
      setBentoWorkspaceOpen: mocks.setBentoWorkspaceOpen,
      setCutoutEditorOpen: mocks.setCutoutEditorOpen,
    })
  ),
}));

function setParams(base: Partial<BinParams['base']> = {}, rest: Partial<BinParams> = {}): void {
  mocks.params = {
    ...DEFAULT_BIN_PARAMS,
    ...rest,
    compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 0, 1, 2, 3, 4] },
    base: { ...DEFAULT_BIN_PARAMS.base, ...base },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setParams();
});

describe('InteriorModes', () => {
  it('gives every mode its own icon', () => {
    const { rerender } = render(<>{INTERIOR_MODE_META.standard.icon}</>);
    expect(screen.getByTestId('grid-icon')).toBeInTheDocument();
    rerender(<>{INTERIOR_MODE_META.bento.icon}</>);
    expect(screen.getByTestId('bento-icon')).toBeInTheDocument();
    rerender(<>{INTERIOR_MODE_META.slotted.icon}</>);
    expect(screen.getByTestId('divider-icon')).toBeInTheDocument();
    rerender(<>{INTERIOR_MODE_META.solid.icon}</>);
    expect(screen.getByTestId('scissors-icon')).toBeInTheDocument();
  });

  it('edits grid dividers inline', () => {
    render(<InteriorModeContent card="standard" />);

    expect(screen.getByTestId('compartment-editor')).toBeInTheDocument();
  });

  it('opens the bento workspace rather than editing inline', () => {
    render(<InteriorModeContent card="bento" />);

    // Bento holds a door, not the editor.
    expect(screen.queryByTestId('compartment-editor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('binDesigner.openBentoWorkspace'));
    expect(mocks.setBentoWorkspaceOpen).toHaveBeenCalledWith(true);
  });

  it('summarises the current bento grid', () => {
    render(<InteriorModeContent card="bento" />);

    // The mocked grid has exactly one merged (drawn) compartment — the
    // summary counts drawn compartments, not background pockets.
    expect(screen.getByText('binDesigner.bento.summary.one')).toBeInTheDocument();
  });

  describe('solid cutout editor', () => {
    it('opens the editor on a plain bin', () => {
      render(<InteriorModeContent card="solid" />);

      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).toHaveBeenCalledWith(true);
    });

    it('blocks the editor under an interior lightweight floor', () => {
      setParams({ lightweight: true, lightweightMode: 'interior' });
      render(<InteriorModeContent card="solid" />);

      expect(screen.getByText('binDesigner.lightweightDisablesCutouts')).toBeInTheDocument();
      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).not.toHaveBeenCalled();
    });

    it('keeps the editor open-able under an underside lightweight relief', () => {
      // The relief shells from below and leaves the interior floor a cutout
      // cuts into, so it is not one of the things that rules cutouts out.
      setParams({ lightweight: true, lightweightMode: 'underside' });
      render(<InteriorModeContent card="solid" />);

      expect(screen.queryByText('binDesigner.lightweightDisablesCutouts')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).toHaveBeenCalledWith(true);
    });

    it('blocks the editor on a spacer', () => {
      setParams({ spacer: true });
      render(<InteriorModeContent card="solid" />);

      expect(screen.getByText('binDesigner.spacerDisablesInterior')).toBeInTheDocument();
      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).not.toHaveBeenCalled();
    });

    it('blocks the editor on a base-only bin', () => {
      setParams({ tile: true });
      render(<InteriorModeContent card="solid" />);

      expect(screen.getByText('binDesigner.tileDisablesInterior')).toBeInTheDocument();
      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).not.toHaveBeenCalled();
    });
  });
});
