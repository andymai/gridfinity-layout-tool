import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BaseplateLibraryInitMount } from './BaseplateLibraryInitMount';

const mocks = vi.hoisted(() => ({
  useBaseplateLibraryInit: vi.fn(),
}));

vi.mock('@/features/baseplate/hooks/useBaseplateLibraryInit', () => ({
  useBaseplateLibraryInit: () => mocks.useBaseplateLibraryInit(),
}));

describe('BaseplateLibraryInitMount', () => {
  it('mounts the resolver hook and renders nothing', () => {
    const { container } = render(<BaseplateLibraryInitMount />);
    expect(mocks.useBaseplateLibraryInit).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });
});
