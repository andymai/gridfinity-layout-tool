import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';
import { LibraryThumbnail } from './LibraryThumbnail';

const queue = vi.hoisted(() => ({ ready: null as null | ((url: string) => void) }));

vi.mock('./thumbnailQueue', () => ({
  requestThumbnail: (_item: unknown, onReady: (url: string) => void) => {
    queue.ready = onReady;
    return () => {
      queue.ready = null;
    };
  },
}));

const item: CutoutLibraryItem = {
  id: 'clib_1',
  name: 'Wrench',
  folderId: null,
  createdAt: '2026-11-22T00:00:00.000Z',
  updatedAt: '2026-11-22T00:00:00.000Z',
  content: {
    params: {
      cutouts: [
        {
          id: 'a',
          shape: 'rectangle',
          x: 0,
          y: 0,
          width: 40,
          depth: 10,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        },
      ],
    },
  },
};

describe('LibraryThumbnail', () => {
  beforeEach(() => {
    queue.ready = null;
  });

  it('draws the outline until the render is ready, then shows the render', async () => {
    const { container } = render(<LibraryThumbnail item={item} size={40} />);
    expect(container.querySelector('svg path')).not.toBeNull();
    act(() => queue.ready?.('data:image/webp;base64,AAA'));
    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/webp;base64,AAA')
    );
  });
});
