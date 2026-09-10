import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAnchoredMenu } from './useAnchoredMenu';

function Harness({ onClose, onPick }: { onClose?: () => void; onPick?: () => void }) {
  const { isOpen, menuStyle, menuButtonRef, menuRef, toggle, withClose, onMenuKeyDown } =
    useAnchoredMenu({ onClose });
  return (
    <div>
      <button ref={menuButtonRef} onClick={toggle} aria-expanded={isOpen}>
        more
      </button>
      {isOpen && (
        <div ref={menuRef} role="menu" tabIndex={-1} style={menuStyle} onKeyDown={onMenuKeyDown}>
          <button role="menuitem" onClick={withClose(() => onPick?.())}>
            pick
          </button>
        </div>
      )}
      <span data-testid="outside">outside</span>
    </div>
  );
}

function rectAt(top: number): DOMRect {
  return { top, bottom: top + 20, right: 300, left: 260, width: 40, height: 20 } as DOMRect;
}

describe('useAnchoredMenu', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
  });

  it('opens below the button, right-aligned, with a fixed position', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'more' });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rectAt(100));

    fireEvent.click(button);

    const menu = screen.getByRole('menu');
    expect(menu.style.position).toBe('fixed');
    expect(menu.style.right).toBe('700px');
    expect(menu.style.top).toBe('124px');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens above the button when there is little room below', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'more' });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rectAt(700));

    fireEvent.click(button);

    const menu = screen.getByRole('menu');
    expect(menu.style.bottom).toBe('104px');
    expect(menu.style.top).toBe('');
  });

  it('closes on a click outside and reports it', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'more' }));

    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open on a mousedown inside the menu', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'more' }));

    fireEvent.mouseDown(screen.getByRole('menuitem'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('runs an item action, then closes and reports it', () => {
    const onClose = vi.fn();
    const onPick = vi.fn();
    render(<Harness onClose={onClose} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'more' }));

    fireEvent.click(screen.getByRole('menuitem'));

    expect(onPick).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles closed from the button and reports it', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const button = screen.getByRole('button', { name: 'more' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
