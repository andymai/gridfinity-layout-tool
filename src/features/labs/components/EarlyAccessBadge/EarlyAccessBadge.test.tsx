import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EarlyAccessBadge } from '.';

describe('EarlyAccessBadge', () => {
  it('names the feature as early access', () => {
    render(<EarlyAccessBadge />);
    expect(screen.getByText('Early access')).toBeDefined();
  });
});
