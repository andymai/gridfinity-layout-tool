import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinSlantBadge } from './BinSlantBadge';

describe('BinSlantBadge', () => {
  it('names the problem for screen readers and on hover', () => {
    render(<BinSlantBadge small={false} />);
    expect(screen.getByLabelText('Slant needs attention')).toBeInTheDocument();
    expect(screen.getByTitle('Slant needs attention')).toBeInTheDocument();
  });
});
