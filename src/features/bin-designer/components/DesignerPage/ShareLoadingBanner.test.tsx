import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareLoadingBanner } from './ShareLoadingBanner';

describe('ShareLoadingBanner', () => {
  it('renders loading message', () => {
    render(<ShareLoadingBanner />);
    expect(screen.getByText(/loading shared design/i)).toBeInTheDocument();
  });
});
