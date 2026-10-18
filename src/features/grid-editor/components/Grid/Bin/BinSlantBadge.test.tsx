import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinSlantBadge } from './BinSlantBadge';

describe('BinSlantBadge', () => {
  it('points the way the bin leans', () => {
    render(<BinSlantBadge small={false} side="right" attention={false} />);
    expect(screen.getByLabelText('Slant')).toBeInTheDocument();
    expect(screen.getByTitle('Slant')).toHaveStyle({ transform: 'rotate(90deg)' });
  });

  it('turns to a warning when the row needs attention', () => {
    render(<BinSlantBadge small={false} side="back" attention={true} />);
    expect(screen.getByLabelText('Slant needs attention')).toBeInTheDocument();
    expect(screen.getByTitle('Slant needs attention')).toBeInTheDocument();
  });
});
