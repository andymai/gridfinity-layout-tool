import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutCradleControls } from './CutoutCradleControls';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key,
}));

function rect(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'r1',
    shape: 'rectangle',
    x: 10,
    y: 0,
    width: 60,
    depth: 39,
    cutDepth: 12,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

describe('CutoutCradleControls', () => {
  it('turns a rectangle into a cradle and back', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <CutoutCradleControls cutout={rect()} maxCutDepth={20} onUpdate={onUpdate} />
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onUpdate).toHaveBeenLastCalledWith({ cradle: true });

    rerender(
      <CutoutCradleControls cutout={rect({ cradle: true })} maxCutDepth={20} onUpdate={onUpdate} />
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onUpdate).toHaveBeenLastCalledWith({ cradle: undefined });
  });

  it('shows the arc radius for the depth the bin can cut', () => {
    const { rerender } = render(
      <CutoutCradleControls cutout={rect({ cradle: true })} maxCutDepth={20} onUpdate={vi.fn()} />
    );
    // (30² + 12²) / 24
    expect(screen.getByText(/"radius":"43.5"/)).toBeInTheDocument();

    // Only 10mm of fill: the worker cuts 10mm, so the arc is (30² + 10²) / 20.
    rerender(
      <CutoutCradleControls cutout={rect({ cradle: true })} maxCutDepth={10} onUpdate={vi.fn()} />
    );
    expect(screen.getByText(/"radius":"50.0"/)).toBeInTheDocument();
  });

  it('shows no radius until the pocket is a cradle', () => {
    render(<CutoutCradleControls cutout={rect()} maxCutDepth={20} onUpdate={vi.fn()} />);
    expect(screen.queryByText(/cradleRadius/)).toBeNull();
  });

  it('offers nothing on a shape that cannot be a cradle', () => {
    const { container } = render(
      <CutoutCradleControls
        cutout={rect({ shape: 'circle' })}
        maxCutDepth={20}
        onUpdate={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
