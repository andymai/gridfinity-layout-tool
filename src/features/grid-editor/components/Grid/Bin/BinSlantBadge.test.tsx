import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinSlantBadge } from './BinSlantBadge';

describe('BinSlantBadge', () => {
  it('points the way the bin leans', () => {
    render(<BinSlantBadge small={false} side="right" attention={false} />);
    expect(screen.getByLabelText('Slant (Right)')).toBeInTheDocument();
    expect(screen.getByTitle('Slant (Right)')).toHaveStyle({ transform: 'rotate(90deg)' });
  });

  it('turns to an upright warning when the row needs attention', () => {
    render(<BinSlantBadge small={false} side="front" attention={true} />);
    expect(screen.getByLabelText('Slant needs attention')).toBeInTheDocument();
    expect(screen.getByTitle('Slant needs attention').style.transform).toBe('');
  });
});
