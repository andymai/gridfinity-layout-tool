import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LipZoneRow } from './LipZoneRow';

const corners = {
  frontLeft: '#ff0000',
  frontRight: '#00ff00',
  backRight: '#0000ff',
  backLeft: '#ffffff',
};

describe('LipZoneRow', () => {
  it('renders the label', () => {
    render(
      <LipZoneRow
        label="Stacking Lip"
        corners={corners}
        isExpanded={false}
        onToggleExpand={() => undefined}
        onHover={() => undefined}
      />
    );
    expect(screen.getByText('Stacking Lip')).toBeInTheDocument();
  });

  it('invokes onToggleExpand on click', () => {
    const onToggle = vi.fn();
    render(
      <LipZoneRow
        label="Stacking Lip"
        corners={corners}
        isExpanded={false}
        onToggleExpand={onToggle}
        onHover={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stacking Lip' }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('pins the whole-lip hover target on pointer enter and clears on leave', () => {
    const onHover = vi.fn();
    render(
      <LipZoneRow
        label="Stacking Lip"
        corners={corners}
        isExpanded={false}
        onToggleExpand={() => undefined}
        onHover={onHover}
      />
    );
    const trigger = screen.getByRole('button', { name: 'Stacking Lip' });
    fireEvent.pointerEnter(trigger);
    expect(onHover).toHaveBeenLastCalledWith('lip');
    fireEvent.pointerLeave(trigger);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('reflects expanded state on aria-expanded', () => {
    const { rerender } = render(
      <LipZoneRow
        label="Stacking Lip"
        corners={corners}
        isExpanded={false}
        onToggleExpand={() => undefined}
        onHover={() => undefined}
      />
    );
    expect(screen.getByRole('button', { name: 'Stacking Lip' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    rerender(
      <LipZoneRow
        label="Stacking Lip"
        corners={corners}
        isExpanded={true}
        onToggleExpand={() => undefined}
        onHover={() => undefined}
      />
    );
    expect(screen.getByRole('button', { name: 'Stacking Lip' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});
