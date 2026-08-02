// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';
import { ExampleGalleryContent } from './ExampleGalleryContent';

vi.mock('@/features/bin-designer/utils/exampleToDesign', () => ({
  exampleToDesign: vi.fn().mockResolvedValue({ ok: true, value: { id: 'd1' } }),
}));

describe('ExampleGalleryContent', () => {
  // Count only card thumbnails, not incidental icon SVGs that may expose role="img".
  const cardThumbCount = (container: HTMLElement): number =>
    container.querySelectorAll('[data-example-card] img').length;

  it('renders at least one example card without any dialog chrome of its own', () => {
    const { container } = render(<ExampleGalleryContent onRequestClose={vi.fn()} />);
    expect(cardThumbCount(container)).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('filtering by a technique pill narrows the grid', () => {
    const { container } = render(<ExampleGalleryContent onRequestClose={vi.fn()} />);
    const totalImages = cardThumbCount(container);

    const slottedCount = EXAMPLE_DESIGNS.filter((e) => e.techniques.includes('slotted')).length;

    const slottedPill = screen.getByRole('tab', { name: 'Slotted' });
    fireEvent.click(slottedPill);

    expect(cardThumbCount(container)).toBe(slottedCount);
    expect(slottedCount).toBeLessThan(totalImages);
  });

  it('selecting a card opens the preview overlay and back returns to the grid', () => {
    const { container } = render(<ExampleGalleryContent onRequestClose={vi.fn()} />);
    const firstCard = container.querySelector('[data-example-card]');
    expect(firstCard).not.toBeNull();
    if (firstCard) fireEvent.click(firstCard);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to gallery' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
