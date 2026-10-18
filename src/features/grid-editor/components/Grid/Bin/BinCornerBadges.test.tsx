import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinCornerBadges } from './BinCornerBadges';

describe('BinCornerBadges', () => {
  it('renders nothing for an unlocked upright bin', () => {
    const { container } = render(
      <BinCornerBadges small={false} locked={false} slantSide={null} slantAttention={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the lock and the lean side by side', () => {
    render(<BinCornerBadges small={true} locked={true} slantSide="back" slantAttention={false} />);
    expect(screen.getByLabelText('Size locked')).toBeInTheDocument();
    expect(screen.getByLabelText('Slant (Back)')).toBeInTheDocument();
  });
});
