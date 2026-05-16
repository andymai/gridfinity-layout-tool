import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorZoneRow } from './ColorZoneRow';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';

vi.mock('@/design-system/Popover/Popover', () => ({
  Popover: ({
    children,
    anchorRef,
  }: {
    children: React.ReactNode;
    anchorRef: { current: HTMLElement | null };
  }) => (
    <div data-testid="popover" data-anchored={anchorRef.current ? 'true' : 'false'}>
      {children}
    </div>
  ),
}));

vi.mock('./ColorPicker', () => ({
  ColorPicker: ({ color, zoneLabel }: { color: string; zoneLabel: string }) => (
    <div data-testid="color-picker">
      {zoneLabel} {color}
    </div>
  ),
}));

const baseProps = {
  zone: 'body' as ColorZone,
  label: 'Body',
  color: '#3b82f6',
  defaultColor: '#d4d8dc',
  otherColors: [],
  onChange: () => undefined,
  onHover: () => undefined,
};

describe('ColorZoneRow', () => {
  it('renders zone label, hex value, and swatch', () => {
    render(<ColorZoneRow {...baseProps} />);
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('#3b82f6')).toBeInTheDocument();
  });

  it('opens color picker on click', () => {
    render(<ColorZoneRow {...baseProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
  });

  it('passes the trigger button as the popover anchor (no null-anchor race)', () => {
    render(<ColorZoneRow {...baseProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('popover')).toHaveAttribute('data-anchored', 'true');
  });

  it('closes color picker on second click', () => {
    render(<ColorZoneRow {...baseProps} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByTestId('color-picker')).not.toBeInTheDocument();
  });

  it('calls onHover with zone on pointer enter and null on pointer leave when closed', () => {
    const onHover = vi.fn();
    render(<ColorZoneRow {...baseProps} onHover={onHover} />);
    const button = screen.getByRole('button');
    fireEvent.pointerEnter(button);
    expect(onHover).toHaveBeenLastCalledWith('body');
    fireEvent.pointerLeave(button);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('keeps the zone pinned for hover preview while the popover is open', () => {
    const onHover = vi.fn();
    render(<ColorZoneRow {...baseProps} onHover={onHover} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    onHover.mockClear();
    fireEvent.pointerLeave(button);
    // pointerLeave must NOT clear the hover while popover is open
    expect(onHover).not.toHaveBeenCalledWith(null);
  });

  it('clears the hover pin when the popover closes (even if pointer already left)', () => {
    const onHover = vi.fn();
    render(<ColorZoneRow {...baseProps} onHover={onHover} />);
    const button = screen.getByRole('button');

    // Open and walk pointer off the row before closing — pointerLeave
    // is suppressed because isOpen is true, so the only path to clear
    // the glow is the effect's cleanup running on close.
    fireEvent.click(button);
    fireEvent.pointerLeave(button);
    onHover.mockClear();

    fireEvent.click(button);
    expect(onHover).toHaveBeenCalledWith(null);
  });
});
