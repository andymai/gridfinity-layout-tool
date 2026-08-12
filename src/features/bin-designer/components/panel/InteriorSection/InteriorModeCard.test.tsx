import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorModeCard } from './InteriorModeCard';

// Mock the icons
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
}));

// Mock store — runs the selector against a minimal fake so the workspace
// launcher cards render (they read compartments and the open actions).
vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      params: {
        compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 0, 1, 2, 3, 4] },
        base: { lightweight: false },
      },
      setBentoWorkspaceOpen: mocks.setBentoWorkspaceOpen,
      setCutoutEditorOpen: mocks.setCutoutEditorOpen,
    })
  ),
}));

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
});
