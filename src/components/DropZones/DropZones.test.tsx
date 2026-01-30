import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DropZones } from './DropZones';

vi.mock('@/core/store', () => ({
  useUIStore: vi.fn((selector: unknown) => {
    const state = {
      interaction: null,
      dropTarget: null,
      setDropTarget: vi.fn(),
    };
    return (selector as (s: typeof state) => unknown)(state);
  }),
}));

describe('DropZones', () => {
  it('renders nothing when not dragging', () => {
    const { container } = render(<DropZones />);
    expect(container.firstChild).toBeNull();
  });
});
