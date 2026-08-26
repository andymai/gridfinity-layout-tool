import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WebGLFallback } from './WebGLFallback';

describe('WebGLFallback', () => {
  it('renders the localized title and a help link', () => {
    render(<WebGLFallback />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://get.webgl.org/');
  });
});
