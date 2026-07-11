import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BaseplateLibraryInitMount } from './BaseplateLibraryInitMount';

const useBaseplateLibraryInit = vi.fn();

vi.mock('@/features/baseplate/hooks/useBaseplateLibraryInit', () => ({
  useBaseplateLibraryInit: () => useBaseplateLibraryInit(),
}));

describe('BaseplateLibraryInitMount', () => {
  it('mounts the resolver hook and renders nothing', () => {
    const { container } = render(<BaseplateLibraryInitMount />);
    expect(useBaseplateLibraryInit).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });
});
