import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorZoneRow } from './ColorZoneRow';

// Mock Popover to avoid portal issues in tests
vi.mock('@/design-system/Popover/Popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock ColorPicker
vi.mock('./ColorPicker', () => ({
  ColorPicker: ({ color }: { color: string }) => <div data-testid="color-picker">{color}</div>,
}));

describe('ColorZoneRow', () => {
  it('renders zone label and color dot', () => {
    render(<ColorZoneRow label="Body" color="#3b82f6" onChange={vi.fn()} />);
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('opens color picker on click', () => {
    render(<ColorZoneRow label="Body" color="#3b82f6" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
  });

  it('closes color picker on second click', () => {
    render(<ColorZoneRow label="Body" color="#3b82f6" onChange={vi.fn()} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByTestId('color-picker')).not.toBeInTheDocument();
  });
});
