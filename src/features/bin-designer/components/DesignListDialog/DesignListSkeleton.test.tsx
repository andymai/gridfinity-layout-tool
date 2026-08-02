// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DesignListSkeleton } from './DesignListSkeleton';

describe('DesignListSkeleton', () => {
  it('renders three placeholder rows', () => {
    const { container } = render(<DesignListSkeleton />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });

  it('opts placeholder rows out of animation under reduced motion', () => {
    const { container } = render(<DesignListSkeleton />);
    expect(container.querySelectorAll('.motion-reduce\\:animate-none')).toHaveLength(3);
  });
});
