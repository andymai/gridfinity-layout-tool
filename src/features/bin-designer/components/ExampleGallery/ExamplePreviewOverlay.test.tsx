// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { ExamplePreviewOverlay } from './ExamplePreviewOverlay';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('./Example3DViewer', () => ({
  Example3DViewer: () => <div data-testid="example-3d-viewer" />,
}));

const addToast = vi.fn();
vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (state: { addToast: typeof addToast }) => unknown) =>
    selector({ addToast }),
}));

const example = {
  id: 'ex-1',
  nameKey: 'example.name',
  descriptionKey: 'example.description',
  techniques: ['scoop'],
  tier: 'technique',
  tags: [],
  complexity: 1,
  params: { heightUnitMm: 7 },
  metrics: { width: 2, depth: 1, height: 3, gridUnitMm: 42 },
} as unknown as ExampleDesign;

describe('ExamplePreviewOverlay', () => {
  it('renders the preview dialog with the example name and viewer', () => {
    render(<ExamplePreviewOverlay example={example} onClose={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('example.name')).toBeInTheDocument();
    expect(screen.getByTestId('example-3d-viewer')).toBeInTheDocument();
  });

  it('fires onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<ExamplePreviewOverlay example={example} onClose={vi.fn()} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'binExamples.backToGallery' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
