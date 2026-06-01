// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';
import { ExampleGallery } from './ExampleGallery';

vi.mock('@/features/bin-designer/utils/exampleToDesign', () => ({
  exampleToDesign: vi.fn().mockResolvedValue({ ok: true, value: { id: 'd1' } }),
}));

describe('ExampleGallery', () => {
  // Count only card thumbnails, not incidental icon SVGs that may expose role="img".
  const cardThumbCount = (container: HTMLElement): number =>
    container.querySelectorAll('[data-example-card] img').length;

  it('renders a dialog with at least one example card', () => {
    const onClose = vi.fn();
    const { container } = render(<ExampleGallery onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // at least one example thumbnail rendered
    expect(cardThumbCount(container)).toBeGreaterThan(0);
  });

  it('filtering by a technique pill narrows the grid', () => {
    const { container } = render(<ExampleGallery onClose={vi.fn()} />);
    const totalImages = cardThumbCount(container);

    const slottedCount = EXAMPLE_DESIGNS.filter((e) => e.techniques.includes('slotted')).length;

    const slottedPill = screen.getByRole('tab', { name: 'Slotted' });
    fireEvent.click(slottedPill);

    expect(cardThumbCount(container)).toBe(slottedCount);
    expect(slottedCount).toBeLessThan(totalImages);
  });
});
