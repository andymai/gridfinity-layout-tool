// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore } from '@/core/store';
import { useLayoutStore } from '@/core/store/layout';
import { baseplateDesignId, layoutId } from '@/core/types';
import type { LayoutEntry } from '@/core/types';
import { resetAllStores, createTestLayout } from '@/test/testUtils';
import { designUsage, findDesignUsers } from './designUsers';

const entry = (id: string, name: string, baseplateId: string | null): LayoutEntry =>
  ({
    id: layoutId(id),
    name,
    createdAt: 1,
    modifiedAt: 1,
    preview: {
      drawerWidth: 4,
      drawerDepth: 4,
      drawerHeight: 7,
      binCount: 0,
      layerCount: 1,
      baseplateId,
    },
  }) as LayoutEntry;

describe('designUsers', () => {
  beforeEach(() => {
    resetAllStores();
    useLayoutStore
      .getState()
      .importLayout(
        createTestLayout({ name: 'Kitchen (renamed)', activeBaseplateId: baseplateDesignId('B') }),
        layoutId('open')
      );
    const { library } = useLibraryStore.getState();
    useLibraryStore.setState({
      library: {
        ...library,
        entries: [
          entry('open', 'Kitchen', 'A'),
          entry('garage', 'Garage', 'B'),
          entry('shed', 'Shed', null),
        ],
      },
    });
  });

  it('groups layout names by the design they link, reading the open layout live', async () => {
    const usage = await designUsage();
    expect(usage.get('B')).toEqual(['Kitchen (renamed)', 'Garage']);
    expect(usage.has('A')).toBe(false);
  });

  it('finds the layouts using one design', async () => {
    const users = await findDesignUsers('B');
    expect(users.map((u) => u.id)).toEqual([layoutId('open'), layoutId('garage')]);
  });
});
