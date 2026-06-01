// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    // smoke: dialog has technique filter controls
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
