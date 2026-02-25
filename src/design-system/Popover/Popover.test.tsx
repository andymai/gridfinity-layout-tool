import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Popover } from './Popover';
import { createRef } from 'react';

describe('Popover', () => {
  let anchorRef: React.RefObject<HTMLButtonElement>;
  let anchorEl: HTMLButtonElement;

  beforeEach(() => {
    anchorEl = document.createElement('button');
    anchorEl.textContent = 'Anchor';
    document.body.appendChild(anchorEl);
    anchorEl.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 50,
      bottom: 140,
      right: 150,
      width: 100,
      height: 40,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    }));

    anchorRef = createRef<HTMLButtonElement>();
    Object.defineProperty(anchorRef, 'current', { value: anchorEl, writable: true });
  });

  afterEach(() => {
    anchorEl.remove();
  });

  it('renders children when open', () => {
    render(
      <Popover anchorRef={anchorRef} isOpen onClose={vi.fn()}>
        <span>Popover content</span>
      </Popover>
    );

    expect(screen.getByText('Popover content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Popover anchorRef={anchorRef} isOpen={false} onClose={vi.fn()}>
        <span>Popover content</span>
      </Popover>
    );

    expect(screen.queryByText('Popover content')).not.toBeInTheDocument();
  });

  it('renders in a portal (in document.body)', () => {
    const { container } = render(
      <Popover anchorRef={anchorRef} isOpen onClose={vi.fn()}>
        <span>Portal content</span>
      </Popover>
    );

    // Content should NOT be inside the render container (it's in a portal)
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    // But it should be in the document
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Popover anchorRef={anchorRef} isOpen onClose={onClose}>
        <span>Content</span>
      </Popover>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on click outside', () => {
    const onClose = vi.fn();
    render(
      <Popover anchorRef={anchorRef} isOpen onClose={onClose}>
        <span>Content</span>
      </Popover>
    );

    fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside popover', () => {
    const onClose = vi.fn();
    render(
      <Popover anchorRef={anchorRef} isOpen onClose={onClose}>
        <button>Inside</button>
      </Popover>
    );

    fireEvent.mouseDown(screen.getByText('Inside'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking anchor element', () => {
    const onClose = vi.fn();
    render(
      <Popover anchorRef={anchorRef} isOpen onClose={onClose}>
        <span>Content</span>
      </Popover>
    );

    fireEvent.mouseDown(anchorEl);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <Popover anchorRef={anchorRef} isOpen onClose={vi.fn()} className="w-64 p-4">
        <span>Content</span>
      </Popover>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-64');
    expect(dialog.className).toContain('p-4');
  });
});
