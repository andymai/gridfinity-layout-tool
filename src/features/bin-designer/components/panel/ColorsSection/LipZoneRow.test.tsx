import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LipZoneRow } from './LipZoneRow';
import type { LipColorConfig } from '@/features/bin-designer/types/featureColors';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const corners: LipColorConfig = {
  frontLeft: '#ff0000',
  frontRight: '#00ff00',
  backRight: '#0000ff',
  backLeft: '#ffff00',
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
  it('renders the label and reflects collapsed state via aria-expanded', () => {
    render(<LipZoneRow {...baseProps} />);
    const button = screen.getByRole('button', { name: /Stacking Lip/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'lip-corners');
  });

  it('calls onToggleExpand when the row is clicked', () => {
    const onToggleExpand = vi.fn();
    render(<LipZoneRow {...baseProps} onToggleExpand={onToggleExpand} />);
    fireEvent.click(screen.getByRole('button', { name: /Stacking Lip/ }));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('pins and releases the lip hover glow on pointer enter/leave', () => {
    const onHover = vi.fn();
    render(<LipZoneRow {...baseProps} onHover={onHover} />);
    const button = screen.getByRole('button', { name: /Stacking Lip/ });
    fireEvent.pointerEnter(button);
    expect(onHover).toHaveBeenLastCalledWith('lip');
    fireEvent.pointerLeave(button);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });
});
