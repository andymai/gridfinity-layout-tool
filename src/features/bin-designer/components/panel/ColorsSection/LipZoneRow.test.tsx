import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LipZoneRow } from './LipZoneRow';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const corners = {
  frontLeft: '#ff0000',
  frontRight: '#00ff00',
  backRight: '#0000ff',
  backLeft: '#ffffff',
};

const baseProps = {
  label: 'Stacking Lip',
  corners,
  isExpanded: false,
  onToggleExpand: () => undefined,
  onHover: () => undefined,
  cornersId: 'lip-corners',
};

describe('LipZoneRow', () => {
  it('renders the label and the 4-corners sub-label', () => {
    render(<LipZoneRow {...baseProps} />);
    expect(screen.getByText('Stacking Lip')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.colors.lip.fourCorners')).toBeInTheDocument();
  });

  it('invokes onToggleExpand on click', () => {
    const onToggle = vi.fn();
    render(<LipZoneRow {...baseProps} onToggleExpand={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('pins the whole-lip hover target on pointer enter and clears on leave', () => {
    const onHover = vi.fn();
    render(<LipZoneRow {...baseProps} onHover={onHover} />);
    const trigger = screen.getByRole('button');
    fireEvent.pointerEnter(trigger);
    expect(onHover).toHaveBeenLastCalledWith('lip');
    fireEvent.pointerLeave(trigger);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('reflects expanded state on aria-expanded and aria-controls', () => {
    const { rerender } = render(<LipZoneRow {...baseProps} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'lip-corners');
    rerender(<LipZoneRow {...baseProps} isExpanded={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });
});
