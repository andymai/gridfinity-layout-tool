import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DragPreview } from './DragPreview';

vi.mock('@/core/store', () => ({
  useUIStore: vi.fn((selector: unknown) => {
    const state = { interaction: null, zoom: 1 };
    return (selector as (s: typeof state) => unknown)(state);
  }),
  useLayoutStore: vi.fn((selector: unknown) => {
    const state = { layout: { bins: [], categories: [] } };
    return (selector as (s: typeof state) => unknown)(state);
  }),
}));

vi.mock('@/shared/utils', () => ({
  getContrastColor: () => '#000000',
}));

vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ viewportWidth: 1024 }),
}));

vi.mock('@/core/constants', () => ({
  getBaseCellSize: () => 40,
  DEFAULT_CATEGORY_COLOR: '#808080',
}));

describe('DragPreview', () => {
  it('renders nothing when no interaction', () => {
    const { container } = render(<DragPreview />);
    expect(container.firstChild).toBeNull();
  });
});
