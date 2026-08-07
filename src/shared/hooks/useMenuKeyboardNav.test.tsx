import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useMenuKeyboardNav } from './useMenuKeyboardNav';

function Harness({
  isOpen = true,
  onClose = vi.fn(),
  withInput = false,
  disabledSecond = false,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  withInput?: boolean;
  disabledSecond?: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useMenuKeyboardNav({ isOpen, menuRef, onClose });

  if (!isOpen) return null;

  return (
    <div ref={menuRef} role="menu" tabIndex={-1} onKeyDown={onKeyDown}>
      {withInput && <input aria-label="filter" />}
      <button type="button" role="menuitem">
        One
      </button>
      <button type="button" role="menuitem" disabled={disabledSecond}>
        Two
      </button>
      <button type="button" role="menuitem">
        Three
      </button>
    </div>
  );
}

const menu = () => screen.getByRole('menu');
const items = () => screen.getAllByRole('menuitem');

describe('useMenuKeyboardNav', () => {
  it('moves focus to the first item when the menu opens', async () => {
    render(<Harness />);
    await waitFor(() => expect(items()[0]).toHaveFocus());
  });

  it('traverses down and wraps at the end', async () => {
    render(<Harness />);
    await waitFor(() => expect(items()[0]).toHaveFocus());
    fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(items()[1]).toHaveFocus();
    fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(items()[2]).toHaveFocus();
    fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(items()[0]).toHaveFocus();
  });

  it('traverses up and wraps at the start', async () => {
    render(<Harness />);
    await waitFor(() => expect(items()[0]).toHaveFocus());
    fireEvent.keyDown(menu(), { key: 'ArrowUp' });
    expect(items()[2]).toHaveFocus();
  });

  it('jumps to the ends with Home and End', async () => {
    render(<Harness />);
    await waitFor(() => expect(items()[0]).toHaveFocus());
    fireEvent.keyDown(menu(), { key: 'End' });
    expect(items()[2]).toHaveFocus();
    fireEvent.keyDown(menu(), { key: 'Home' });
    expect(items()[0]).toHaveFocus();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(menu(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('skips disabled items', async () => {
    render(<Harness disabledSecond />);
    await waitFor(() => expect(items()[0]).toHaveFocus());
    fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(items()[2]).toHaveFocus();
  });

  // A menu can hold a filter or rename field; arrow keys there belong to the caret.
  it('leaves caret keys to a text field inside the menu', () => {
    render(<Harness withInput />);
    const input = screen.getByLabelText('filter');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveFocus();
  });

  it('still closes on Escape from a text field inside the menu', () => {
    const onClose = vi.fn();
    render(<Harness withInput onClose={onClose} />);
    const input = screen.getByLabelText('filter');
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // A menu carrying toggles uses menuitemcheckbox/menuitemradio; matching only
  // "menuitem" would leave those menus with nothing to traverse.
  it('traverses checkbox and radio item roles too', async () => {
    function Toggles() {
      const menuRef = useRef<HTMLDivElement>(null);
      const onKeyDown = useMenuKeyboardNav({ isOpen: true, menuRef, onClose: vi.fn() });
      return (
        <div ref={menuRef} role="menu" tabIndex={-1} onKeyDown={onKeyDown}>
          <div role="menuitemcheckbox" aria-checked tabIndex={0}>
            Show layers below
          </div>
          <div role="menuitemradio" aria-checked={false} tabIndex={0}>
            Sort by size
          </div>
        </div>
      );
    }
    render(<Toggles />);
    const check = screen.getByRole('menuitemcheckbox');
    await waitFor(() => expect(check).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio')).toHaveFocus();
  });

  it('skips aria-disabled items', async () => {
    function WithAriaDisabled() {
      const menuRef = useRef<HTMLDivElement>(null);
      const onKeyDown = useMenuKeyboardNav({ isOpen: true, menuRef, onClose: vi.fn() });
      return (
        <div ref={menuRef} role="menu" tabIndex={-1} onKeyDown={onKeyDown}>
          <div role="menuitem" tabIndex={0}>
            One
          </div>
          <div role="menuitem" aria-disabled="true" tabIndex={-1}>
            Two
          </div>
          <div role="menuitem" tabIndex={0}>
            Three
          </div>
        </div>
      );
    }
    render(<WithAriaDisabled />);
    const all = screen.getAllByRole('menuitem');
    await waitFor(() => expect(all[0]).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(all[2]).toHaveFocus();
  });

  it('does not steal focus while the menu is closed', () => {
    render(<Harness isOpen={false} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
