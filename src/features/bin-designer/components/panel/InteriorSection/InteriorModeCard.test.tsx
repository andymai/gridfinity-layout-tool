import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorModeCard } from './InteriorModeCard';
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

// Real DEFAULT_BIN_PARAMS rather than a hand-built stub: the solid card asks the
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

describe('InteriorModeCard', () => {
  it('renders collapsed card with icon, title, and description', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="standard" isExpanded={false} onSelect={onSelect} />);

    expect(screen.getByTestId('grid-icon')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.interior.standard.title')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.interior.standard.description')).toBeInTheDocument();
  });

  it('calls onSelect when header button is clicked', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="standard" isExpanded={false} onSelect={onSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders expanded card with content', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="standard" isExpanded={true} onSelect={onSelect} />);

    expect(screen.getByTestId('compartment-editor')).toBeInTheDocument();
  });

  it('does not render content when collapsed', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="standard" isExpanded={false} onSelect={onSelect} />);

    expect(screen.queryByTestId('compartment-editor')).not.toBeInTheDocument();
  });

  it('renders correct icon for each card', () => {
    const onSelect = vi.fn();

    const { rerender } = render(
      <InteriorModeCard card="standard" isExpanded={false} onSelect={onSelect} />
    );
    expect(screen.getByTestId('grid-icon')).toBeInTheDocument();

    rerender(<InteriorModeCard card="bento" isExpanded={false} onSelect={onSelect} />);
    expect(screen.getByTestId('bento-icon')).toBeInTheDocument();

    rerender(<InteriorModeCard card="slotted" isExpanded={false} onSelect={onSelect} />);
    expect(screen.getByTestId('divider-icon')).toBeInTheDocument();

    rerender(<InteriorModeCard card="solid" isExpanded={false} onSelect={onSelect} />);
    expect(screen.getByTestId('scissors-icon')).toBeInTheDocument();
  });

  it('expanded bento card opens the workspace rather than editing inline', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="bento" isExpanded={true} onSelect={onSelect} />);

    // The bento card holds a door, not the editor.
    expect(screen.queryByTestId('compartment-editor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('binDesigner.openBentoWorkspace'));
    expect(mocks.setBentoWorkspaceOpen).toHaveBeenCalledWith(true);
  });

  it('expanded bento card summarises the current grid', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="bento" isExpanded={true} onSelect={onSelect} />);

    // The mocked grid has exactly one merged (drawn) compartment — the
    // summary counts drawn compartments, not background pockets.
    expect(screen.getByText('binDesigner.bento.summary.one')).toBeInTheDocument();
  });

  it('applies expanded styles to card wrapper when isExpanded is true', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="standard" isExpanded={true} onSelect={onSelect} />);

    // Styles are on the outer wrapper div (parent of the button)
    const wrapper = screen.getByRole('button').parentElement;
    expect(wrapper?.className).toContain('border-accent');
    expect(wrapper?.className).toContain('bg-accent/5');
  });

  it('applies collapsed styles to card wrapper when isExpanded is false', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="standard" isExpanded={false} onSelect={onSelect} />);

    const wrapper = screen.getByRole('button').parentElement;
    expect(wrapper?.className).toContain('border-stroke-subtle');
    expect(wrapper?.className).toContain('bg-surface-elevated');
  });

  it('does not trigger onSelect when clicking inside expanded content', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="standard" isExpanded={true} onSelect={onSelect} />);

    const editor = screen.getByTestId('compartment-editor');
    fireEvent.click(editor);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not trigger onSelect on pointerDown inside expanded content', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard card="standard" isExpanded={true} onSelect={onSelect} />);

    const editor = screen.getByTestId('compartment-editor');
    fireEvent.pointerDown(editor);

    expect(onSelect).not.toHaveBeenCalled();
  });

  describe('experimental badge', () => {
    it('marks the Bento card and only that card', () => {
      const { rerender } = render(
        <InteriorModeCard card="bento" isExpanded={false} onSelect={vi.fn()} />
      );
      // `info` tone, matching the app's other Experimental badges.
      expect(screen.getByText('common.experimental')).toHaveClass('bg-info-muted');
      expect(screen.getByText('binDesigner.interior.bento.title')).toBeInTheDocument();

      rerender(<InteriorModeCard card="standard" isExpanded={false} onSelect={vi.fn()} />);
      expect(screen.queryByText('common.experimental')).not.toBeInTheDocument();
    });
  });
  describe('solid card cutout editor', () => {
    it('opens the editor on a plain bin', () => {
      render(<InteriorModeCard card="solid" isExpanded={true} onSelect={vi.fn()} />);

      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).toHaveBeenCalledWith(true);
    });

    it('blocks the editor under an interior lightweight floor', () => {
      setParams({ lightweight: true, lightweightMode: 'interior' });
      render(<InteriorModeCard card="solid" isExpanded={true} onSelect={vi.fn()} />);

      expect(screen.getByText('binDesigner.lightweightDisablesCutouts')).toBeInTheDocument();
      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).not.toHaveBeenCalled();
    });

    it('keeps the editor open-able under an underside lightweight relief', () => {
      // The relief shells from below and leaves the interior floor a cutout
      // cuts into, so it is not one of the things that rules cutouts out.
      setParams({ lightweight: true, lightweightMode: 'underside' });
      render(<InteriorModeCard card="solid" isExpanded={true} onSelect={vi.fn()} />);

      expect(screen.queryByText('binDesigner.lightweightDisablesCutouts')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).toHaveBeenCalledWith(true);
    });

    it('blocks the editor on a spacer', () => {
      setParams({ spacer: true });
      render(<InteriorModeCard card="solid" isExpanded={true} onSelect={vi.fn()} />);

      expect(screen.getByText('binDesigner.spacerDisablesInterior')).toBeInTheDocument();
      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).not.toHaveBeenCalled();
    });

    it('blocks the editor on a base-only bin', () => {
      setParams({ tile: true });
      render(<InteriorModeCard card="solid" isExpanded={true} onSelect={vi.fn()} />);

      expect(screen.getByText('binDesigner.tileDisablesInterior')).toBeInTheDocument();
      fireEvent.click(screen.getByText('binDesigner.editCutouts'));
      expect(mocks.setCutoutEditorOpen).not.toHaveBeenCalled();
    });
  });
});
