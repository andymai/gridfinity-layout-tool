import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { markWebGLUnavailable, resetWebGLDetectionCacheForTests } from './detectWebGL';
import { WebGLFallback } from './WebGLFallback';

describe('WebGLFallback', () => {
  afterEach(() => {
    resetWebGLDetectionCacheForTests();
  });

  it('renders the localized title and a help link', () => {
    markWebGLUnavailable('context-failed');
    render(<WebGLFallback />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://get.webgl.org/');
  });

  it('offers a reload instead of WebGL setup advice after a lost context', () => {
    markWebGLUnavailable('context-lost');
    render(<WebGLFallback />);

    expect(screen.getByText('The 3D view stopped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
