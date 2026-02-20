import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnusedSpaceRow } from './UnusedSpaceRow';

describe('UnusedSpaceRow', () => {
  it('renders unused space with correct units and mm', () => {
    render(<UnusedSpaceRow unusedHeight={6} heightUnitMm={7} />);
    expect(screen.getByText('6u unused (42mm)')).toBeInTheDocument();
  });

  it('rounds mm values', () => {
    render(<UnusedSpaceRow unusedHeight={3} heightUnitMm={7.5} />);
    expect(screen.getByText('3u unused (23mm)')).toBeInTheDocument();
  });
});
