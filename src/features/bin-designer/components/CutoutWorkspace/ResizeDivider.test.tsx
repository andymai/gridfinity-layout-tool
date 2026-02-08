import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ResizeDivider } from './ResizeDivider';

describe('ResizeDivider', () => {
  it('renders without crashing', () => {
    const { container } = render(<ResizeDivider onRatioChange={vi.fn()} ratio={0.5} />);

    expect(container.querySelector('[style*="width"]')).toBeInTheDocument();
  });

  it('has col-resize cursor style', () => {
    const { container } = render(<ResizeDivider onRatioChange={vi.fn()} ratio={0.5} />);

    const divider = container.firstChild as HTMLElement;
    expect(divider.className).toContain('cursor-col-resize');
  });
});
