import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { Button } from '../Button';
import { Menu } from './Menu';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  position: { x: 100, y: 100 },
};

function Opener({ onPick }: { onPick: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Options</Button>
      <input aria-label="Elsewhere" />
      <Menu.Root open={open} onClose={() => setOpen(false)} position={{ x: 0, y: 0 }}>
        <Menu.Item onClick={onPick}>Pick</Menu.Item>
      </Menu.Root>
    </>
  );
}

describe('Menu', () => {
  describe('focus on close', () => {
    it('returns focus to what opened the menu', () => {
      render(<Opener onPick={vi.fn()} />);
      const opener = screen.getByRole('button', { name: 'Options' });
      opener.focus();
      fireEvent.click(opener);
      screen.getByRole('menuitem', { name: 'Pick' }).focus();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Pick' }));
      expect(document.activeElement).toBe(opener);
    });

    it('closes on Tab and returns focus to what opened it', () => {
      render(<Opener onPick={vi.fn()} />);
      const opener = screen.getByRole('button', { name: 'Options' });
      opener.focus();
      fireEvent.click(opener);
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab', shiftKey: true });
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(opener);
    });

    it('leaves focus where an item’s action moved it', () => {
      render(<Opener onPick={() => screen.getByLabelText('Elsewhere').focus()} />);
      const opener = screen.getByRole('button', { name: 'Options' });
      opener.focus();
      fireEvent.click(opener);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Pick' }));
      expect(document.activeElement).toBe(screen.getByLabelText('Elsewhere'));
    });
  });

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

  describe('link items', () => {
    it('renders an external anchor when href is set', () => {
      render(
        <Menu.Root {...defaultProps}>
          <Menu.Item href="https://example.com">Docs</Menu.Item>
        </Menu.Root>
      );
      const item = screen.getByRole('menuitem');
      expect(item.tagName).toBe('A');
      expect(item).toHaveAttribute('href', 'https://example.com');
      expect(item).toHaveAttribute('target', '_blank');
      expect(item).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('closes the menu after following a link', () => {
      const onClose = vi.fn();
      render(
        <Menu.Root {...defaultProps} onClose={onClose}>
          <Menu.Item href="https://example.com">Docs</Menu.Item>
        </Menu.Root>
      );
      fireEvent.click(screen.getByRole('menuitem'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('suppresses navigation on a disabled link', () => {
      const onClose = vi.fn();
      render(
        <Menu.Root {...defaultProps} onClose={onClose}>
          <Menu.Item href="https://example.com" disabled>
            Docs
          </Menu.Item>
        </Menu.Root>
      );
      const event = createEvent.click(screen.getByRole('menuitem'));
      fireEvent(screen.getByRole('menuitem'), event);
      expect(event.defaultPrevented).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
