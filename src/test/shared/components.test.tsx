import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { SectionHeader } from '@/shared/components/SectionHeader/SectionHeader';
import { ContextMenuDivider } from '@/shared/components/ContextMenu/ContextMenuDivider';
import { ContextMenuItem } from '@/shared/components/ContextMenu/ContextMenuItem';
import { ContextMenuContainer } from '@/shared/components/ContextMenu/ContextMenuContainer';
import { Checkbox } from '@/shared/components/Checkbox/Checkbox';

describe('SectionHeader', () => {
  it('renders title text', () => {
    render(<SectionHeader title="Settings" />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders as h3 element', () => {
    render(<SectionHeader title="Test" />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Test');
  });

  it('applies custom className', () => {
    render(<SectionHeader title="Custom" className="my-custom-class" />);
    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('my-custom-class');
  });

  it('has uppercase styling class', () => {
    render(<SectionHeader title="Header" />);
    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('uppercase');
  });
});

describe('ContextMenuDivider', () => {
  it('renders a divider element', () => {
    const { container } = render(<ContextMenuDivider />);
    const divider = container.firstChild;
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveClass('border-t');
  });
});

describe('ContextMenuContainer', () => {
  const defaultProps = {
    isOpen: true,
    position: { x: 100, y: 200 },
    onClose: vi.fn(),
    menuRef: createRef<HTMLDivElement>(),
    children: <div>Menu Content</div>,
  };

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <ContextMenuContainer {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders menu when isOpen is true', () => {
    render(<ContextMenuContainer {...defaultProps} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Menu Content')).toBeInTheDocument();
  });

  it('positions menu at specified coordinates', () => {
    render(<ContextMenuContainer {...defaultProps} />);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '100px', top: '200px' });
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ContextMenuContainer {...defaultProps} onClose={onClose} />
    );
    // Backdrop is the first element before the menu
    const backdrop = container.querySelector('.fixed.inset-0');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has accessible menu role and label', () => {
    render(<ContextMenuContainer {...defaultProps} />);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('aria-label', 'Context menu');
  });
});

describe('ContextMenuItem', () => {
  const mockIcon = <svg data-testid="test-icon" />;

  it('renders label text', () => {
    render(
      <ContextMenuItem icon={mockIcon} label="Edit" onClick={vi.fn()} />
    );
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <ContextMenuItem icon={mockIcon} label="Test" onClick={vi.fn()} />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(
      <ContextMenuItem icon={mockIcon} label="Click Me" onClick={handleClick} />
    );
    fireEvent.click(screen.getByRole('menuitem'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies destructive styling when destructive prop is true', () => {
    render(
      <ContextMenuItem icon={mockIcon} label="Delete" onClick={vi.fn()} destructive />
    );
    const button = screen.getByRole('menuitem');
    expect(button).toHaveClass('text-error');
  });

  it('does not apply destructive styling by default', () => {
    render(
      <ContextMenuItem icon={mockIcon} label="Edit" onClick={vi.fn()} />
    );
    const button = screen.getByRole('menuitem');
    expect(button).toHaveClass('text-content');
    expect(button).not.toHaveClass('text-error');
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <ContextMenuItem icon={mockIcon} label="Disabled" onClick={vi.fn()} disabled />
    );
    const button = screen.getByRole('menuitem');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50');
    expect(button).toHaveClass('cursor-not-allowed');
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <ContextMenuItem icon={mockIcon} label="Disabled" onClick={handleClick} disabled />
    );
    fireEvent.click(screen.getByRole('menuitem'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('has menuitem role', () => {
    render(
      <ContextMenuItem icon={mockIcon} label="Menu Item" onClick={vi.fn()} />
    );
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
  });
});

describe('Checkbox', () => {
  describe('display-only mode (no onChange)', () => {
    it('renders checked state', () => {
      const { container } = render(<Checkbox checked={true} />);
      // Should have the checkmark SVG when checked
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders unchecked state without checkmark', () => {
      const { container } = render(<Checkbox checked={false} />);
      // Should not have the checkmark SVG when unchecked
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Checkbox checked={false} label="Enable feature" />);
      expect(screen.getByText('Enable feature')).toBeInTheDocument();
    });

    it('has aria-hidden for display-only mode', () => {
      const { container } = render(<Checkbox checked={false} />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('interactive mode (with onChange)', () => {
    it('renders as checkbox role', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} ariaLabel="Test checkbox" />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('calls onChange when clicked', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Toggle" />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange with false when unchecking', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={true} onChange={handleChange} ariaLabel="Toggle" />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(handleChange).toHaveBeenCalledWith(false);
    });

    it('calls onChange when Space key is pressed', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Toggle" />);
      fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' });
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange when Enter key is pressed', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Toggle" />);
      fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' });
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('does not call onChange when disabled', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Disabled" disabled />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('does not call onChange on keydown when disabled', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Disabled" disabled />);
      fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' });
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('has proper aria-checked attribute', () => {
      const { rerender } = render(<Checkbox checked={false} onChange={vi.fn()} ariaLabel="Test" />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');

      rerender(<Checkbox checked={true} onChange={vi.fn()} ariaLabel="Test" />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    });

    it('applies mobile variant sizing', () => {
      const { container } = render(
        <Checkbox checked={false} onChange={vi.fn()} ariaLabel="Mobile" variant="mobile" />
      );
      // Mobile uses w-6 h-6 sizing
      expect(container.querySelector('.w-6')).toBeInTheDocument();
    });

    it('applies desktop variant sizing by default', () => {
      const { container } = render(
        <Checkbox checked={false} onChange={vi.fn()} ariaLabel="Desktop" />
      );
      // Desktop uses w-4 h-4 sizing
      expect(container.querySelector('.w-4')).toBeInTheDocument();
    });

    it('renders label in interactive mode', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} ariaLabel="Test" label="My Label" />);
      expect(screen.getByText('My Label')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <Checkbox checked={false} onChange={vi.fn()} ariaLabel="Test" className="my-custom-class" />
      );
      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });
});
