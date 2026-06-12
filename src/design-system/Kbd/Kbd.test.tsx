import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { Kbd } from './Kbd';

describe('Kbd', () => {
  it('renders a semantic kbd element with its children', () => {
    render(<Kbd>Enter</Kbd>);
    const kbd = screen.getByText('Enter');
    expect(kbd.tagName).toBe('KBD');
  });

  it('defaults to the neutral tone', () => {
    render(<Kbd>Esc</Kbd>);
    const kbd = screen.getByText('Esc');
    expect(kbd).toHaveClass('bg-surface', 'border-stroke-subtle', 'text-content-secondary');
    expect(kbd).toHaveClass('font-mono');
  });

  it('applies info tone classes', () => {
    render(<Kbd tone="info">⌘Z</Kbd>);
    const kbd = screen.getByText('⌘Z');
    expect(kbd).toHaveClass('bg-info/20', 'border-info/30', 'text-info');
    expect(kbd).not.toHaveClass('font-mono');
  });

  it('keeps base chip classes on every tone', () => {
    render(<Kbd tone="info">Shift</Kbd>);
    const kbd = screen.getByText('Shift');
    expect(kbd).toHaveClass('inline-block', 'rounded', 'border', 'align-middle');
  });

  it('merges a custom className with tone classes', () => {
    render(<Kbd className="custom-class">Tab</Kbd>);
    const kbd = screen.getByText('Tab');
    expect(kbd).toHaveClass('custom-class');
    expect(kbd).toHaveClass('bg-surface');
  });

  it('forwards its ref to the kbd element', () => {
    const ref = createRef<HTMLElement>();
    render(<Kbd ref={ref}>Enter</Kbd>);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe('KBD');
  });

  it('passes through native HTML attributes and handlers', () => {
    const onClick = vi.fn();
    render(
      <Kbd title="Keyboard shortcut" onClick={onClick}>
        K
      </Kbd>
    );
    const kbd = screen.getByText('K');
    expect(kbd).toHaveAttribute('title', 'Keyboard shortcut');
    fireEvent.click(kbd);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
