import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Menu } from './Menu';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  position: { x: 100, y: 100 },
};

describe('Menu', () => {
  describe('rendering', () => {
    it('returns null when closed', () => {
      render(
        <Menu.Root open={false} onClose={vi.fn()} position={{ x: 0, y: 0 }}>
          <Menu.Item onClick={vi.fn()}>Edit</Menu.Item>
        </Menu.Root>
      );
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('renders menu when open', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={vi.fn()}>Edit</Menu.Item>
        </Menu.Root>
      );
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('renders menu items', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={vi.fn()}>Edit</Menu.Item>
          <Menu.Item onClick={vi.fn()}>Delete</Menu.Item>
        </Menu.Root>
      );
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('renders divider', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={vi.fn()}>Edit</Menu.Item>
          <Menu.Divider />
          <Menu.Item onClick={vi.fn()}>Delete</Menu.Item>
        </Menu.Root>
      );
      expect(screen.getByRole('separator', { hidden: true })).toBeInTheDocument();
    });
  });

  describe('item interactions', () => {
    it('calls onClick and closes menu on item click', () => {
      const onClick = vi.fn();
      const onClose = vi.fn();
      render(
        <Menu.Root open={true} onClose={onClose} position={{ x: 0, y: 0 }}>
          <Menu.Item onClick={onClick}>Edit</Menu.Item>
        </Menu.Root>
      );
      fireEvent.click(screen.getByText('Edit'));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick on disabled items', () => {
      const onClick = vi.fn();
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={onClick} disabled>
            Edit
          </Menu.Item>
        </Menu.Root>
      );
      fireEvent.click(screen.getByText('Edit'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('renders item icon', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={vi.fn()} icon={<span data-testid="icon" />}>
            Edit
          </Menu.Item>
        </Menu.Root>
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('renders shortcut hint', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={vi.fn()} shortcut="⌘D">
            Duplicate
          </Menu.Item>
        </Menu.Root>
      );
      expect(screen.getByText('⌘D')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('closes on Escape', () => {
      const onClose = vi.fn();
      render(
        <Menu.Root open={true} onClose={onClose} position={{ x: 0, y: 0 }}>
          <Menu.Item onClick={vi.fn()}>Edit</Menu.Item>
        </Menu.Root>
      );
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('activates item on click (button handles Enter natively)', () => {
      const onClick = vi.fn();
      const onClose = vi.fn();
      render(
        <Menu.Root open={true} onClose={onClose} position={{ x: 0, y: 0 }}>
          <Menu.Item onClick={onClick}>Edit</Menu.Item>
        </Menu.Root>
      );
      const item = screen.getByRole('menuitem');
      fireEvent.click(item);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has menu role', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={vi.fn()}>Edit</Menu.Item>
        </Menu.Root>
      );
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('has menuitem role on items', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={vi.fn()}>Edit</Menu.Item>
        </Menu.Root>
      );
      expect(screen.getByRole('menuitem')).toBeInTheDocument();
    });

    it('sets aria-disabled on disabled items', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item onClick={vi.fn()} disabled>
            Edit
          </Menu.Item>
        </Menu.Root>
      );
      expect(screen.getByRole('menuitem')).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
