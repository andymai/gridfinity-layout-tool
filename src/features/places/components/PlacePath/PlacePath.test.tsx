import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import type { LayoutEntry } from '@/core/types';
import { layoutId } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';
import { PlacePath } from './PlacePath';

const ACTIVE = layoutId('drawer');

function seed(folderKind?: 'place'): void {
  useLayoutStore.setState({ activeLayoutId: ACTIVE });
  useLibraryStore.setState({
    library: {
      version: '1.0',
      activeLayoutId: ACTIVE,
      settings: {},
      entries: [
        {
          id: ACTIVE,
          name: 'Drawer',
          createdAt: 1,
          modifiedAt: 1,
          folderId: 'kitchen',
        } as unknown as LayoutEntry,
      ],
      folders: [
        {
          id: 'kitchen',
          name: 'Kitchen',
          parentId: null,
          kind: folderKind,
          createdAt: 1,
          modifiedAt: 1,
        },
      ],
    },
  });
}

describe('PlacePath', () => {
  beforeEach(() => resetAllStores());

  it('names My place before the folders of a layout outside every place', () => {
    seed();
    render(<PlacePath />);
    expect(screen.getByRole('navigation', { name: 'Where this layout is' })).toHaveTextContent(
      'My place › Kitchen'
    );
  });

  it('starts at the place a layout sits in', () => {
    seed('place');
    render(<PlacePath />);
    expect(screen.getByRole('navigation')).toHaveTextContent(/^Kitchen$/);
    expect(screen.queryByText('My place')).toBeNull();
  });
});
