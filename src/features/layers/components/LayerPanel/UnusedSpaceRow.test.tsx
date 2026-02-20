import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnusedSpaceRow } from './UnusedSpaceRow';

describe('UnusedSpaceRow', () => {
  it('renders headroom with correct units', () => {
    render(<UnusedSpaceRow unusedHeight={6} />);
    expect(screen.getByText('6u headroom')).toBeInTheDocument();
  });
});
