// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';
import { ExampleGallery } from './ExampleGallery';

vi.mock('@/features/bin-designer/utils/exampleToDesign', () => ({
  exampleToDesign: vi.fn().mockResolvedValue({ ok: true, value: { id: 'd1' } }),
}));

describe('ExampleGallery', () => {
  it('renders a dialog with at least one example card', () => {
    const onClose = vi.fn();
    render(<ExampleGallery onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // at least one example thumbnail rendered
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('filtering by a technique pill narrows the grid', () => {
    render(<ExampleGallery onClose={vi.fn()} />);
    const totalImages = screen.getAllByRole('img').length;

    const solidCount = EXAMPLE_DESIGNS.filter((e) => e.techniques.includes('solid')).length;

    const solidPill = screen.getByRole('tab', { name: 'Solid' });
    fireEvent.click(solidPill);

    expect(screen.getAllByRole('img').length).toBe(solidCount);
    expect(solidCount).toBeLessThan(totalImages);
  });
});
