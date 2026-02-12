import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorModeCard } from './InteriorModeCard';

// Mock the icons
vi.mock('./icons', () => ({
  Grid3x3Icon: () => <div data-testid="grid-icon" />,
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
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Mock store
vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: vi.fn(() => undefined),
}));

describe('InteriorModeCard', () => {
  it('renders collapsed card with icon, title, and description', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />);

    expect(screen.getByTestId('grid-icon')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.interior.standard.title')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.interior.standard.description')).toBeInTheDocument();
  });

  it('calls onSelect when header button is clicked', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders expanded card with content', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={true} onSelect={onSelect} />);

    expect(screen.getByTestId('compartment-editor')).toBeInTheDocument();
  });

  it('does not render content when collapsed', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />);

    expect(screen.queryByTestId('compartment-editor')).not.toBeInTheDocument();
  });

  it('renders correct icon for each mode', () => {
    const onSelect = vi.fn();

    const { rerender } = render(
      <InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />
    );
    expect(screen.getByTestId('grid-icon')).toBeInTheDocument();

    rerender(<InteriorModeCard mode="slotted" isExpanded={false} onSelect={onSelect} />);
    expect(screen.getByTestId('divider-icon')).toBeInTheDocument();

    rerender(<InteriorModeCard mode="solid" isExpanded={false} onSelect={onSelect} />);
    expect(screen.getByTestId('scissors-icon')).toBeInTheDocument();
  });

  it('applies expanded styles to card wrapper when isExpanded is true', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={true} onSelect={onSelect} />);

    // Styles are on the outer wrapper div (parent of the button)
    const wrapper = screen.getByRole('button').parentElement;
    expect(wrapper?.className).toContain('border-accent');
    expect(wrapper?.className).toContain('bg-accent/5');
  });

  it('applies collapsed styles to card wrapper when isExpanded is false', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={false} onSelect={onSelect} />);

    const wrapper = screen.getByRole('button').parentElement;
    expect(wrapper?.className).toContain('border-stroke-subtle');
    expect(wrapper?.className).toContain('bg-surface-elevated');
  });

  it('does not trigger onSelect when clicking inside expanded content', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={true} onSelect={onSelect} />);

    const editor = screen.getByTestId('compartment-editor');
    fireEvent.click(editor);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not trigger onSelect on pointerDown inside expanded content', () => {
    const onSelect = vi.fn();
    render(<InteriorModeCard mode="standard" isExpanded={true} onSelect={onSelect} />);

    const editor = screen.getByTestId('compartment-editor');
    fireEvent.pointerDown(editor);

    expect(onSelect).not.toHaveBeenCalled();
  });
});
