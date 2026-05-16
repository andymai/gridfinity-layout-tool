import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { track3DRenderError } = vi.hoisted(() => ({ track3DRenderError: vi.fn() }));
vi.mock('@/shared/analytics/posthog', () => ({ track3DRenderError }));

import { WebGLFallback } from './WebGLFallback';

afterEach(() => {
  track3DRenderError.mockClear();
});

describe('WebGLFallback', () => {
  it('renders the localized title and a help link', () => {
    render(<WebGLFallback reason="context-failed" component="baseplate" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://get.webgl.org/');
  });

  it('reports the unavailable reason on mount', () => {
    render(<WebGLFallback reason="context-lost" component="designer" />);
    expect(track3DRenderError).toHaveBeenCalledWith('designer', 'webgl-unavailable:context-lost');
  });
});
