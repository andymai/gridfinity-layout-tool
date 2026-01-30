import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { ContextMenuContainer } from './ContextMenuContainer';

describe('ContextMenuContainer', () => {
  const defaultProps = {
    isOpen: true,
    position: { x: 100, y: 200 },
    onClose: vi.fn(),
    menuRef: createRef<HTMLDivElement>(),
    children: <div>Menu Content</div>,
  };

  it('renders null when isOpen is false', () => {
    const { container } = render(<ContextMenuContainer {...defaultProps} isOpen={false} />);
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
    const { container } = render(<ContextMenuContainer {...defaultProps} onClose={onClose} />);
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
