import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CutoutDesktopOnlyBanner } from './CutoutDesktopOnlyBanner';

describe('CutoutDesktopOnlyBanner', () => {
  it('renders the desktop-only message', () => {
    render(<CutoutDesktopOnlyBanner />);
    expect(screen.getByText(/desktop/i)).toBeInTheDocument();
  });
});
