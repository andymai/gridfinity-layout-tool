import { test, expect, waitForAppReady, clearAllStorage, resetViewport } from './fixtures';

type Seeded<T> = { ok: true; value: T } | { ok: false };

interface SeedLibrary {
  entries: Array<{ id: string; folderId?: string | null }>;
}

interface SeedLayout {
  name: string;
  layers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string }>;
  bins: Array<Record<string, unknown>>;
}

interface SeedModules {
  createDefaultLayout: () => SeedLayout;
  createFolder: (
    library: SeedLibrary,
    name: string
  ) => Seeded<{ library: SeedLibrary; folder: { id: string } }>;
  createLayoutEntry: (
    layout: SeedLayout,
    library: SeedLibrary,
    options: { name: string }
  ) => Promise<Seeded<{ layoutId: string; library: SeedLibrary }>>;
  saveLibrary: (library: SeedLibrary) => Promise<unknown>;
  useLibraryStore: { getState: () => { library: SeedLibrary } };
}

/**
 * The seed imports the app's own modules by their `/src/` path, which only the
 * Vite dev server serves, so this spec runs against `pnpm run dev`.
 */
test.describe('Places: Find across layouts', () => {
  // The command palette and the layer sidebar are desktop surfaces: phones
  // have no palette, and the tablet layout starts with the sidebar collapsed.
  const isDesktop = ({ viewport }: { viewport: { width: number } | null }): boolean =>
    (viewport?.width ?? 0) >= 900;
  test.skip(({ viewport }) => !isDesktop({ viewport }), 'desktop layout only');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'gridfinity-labs-v1',
        JSON.stringify({
          enabledFeatures: { places: true },
          lastModified: new Date().toISOString(),
          version: 1,
        })
      );
    });
    await page.goto('/');
    await waitForAppReady(page);

    await page.evaluate(async () => {
      const paths = [
        '/src/core/constants.ts',
        '/src/core/storage/index.ts',
        '/src/core/store/library.ts',
      ];
      const loaded: unknown[] = await Promise.all(paths.map((path) => import(path)));
      const app = Object.assign({}, ...loaded) as SeedModules;

      let library = app.useLibraryStore.getState().library;
      const folderIds: string[] = [];
      for (const name of ['Kitchen', 'Garage']) {
        const made = app.createFolder(library, name);
        if (!made.ok) throw new Error(`Could not create the ${name} folder`);
        library = made.value.library;
        folderIds.push(made.value.folder.id);
      }

      const seeds: Array<{ name: string; folderId: string; bins: Array<[string, boolean]> }> = [
        { name: 'Cutlery drawer', folderId: folderIds[0], bins: [['Forks', false]] },
        { name: 'Spice drawer', folderId: folderIds[0], bins: [['Cumin', false]] },
        {
          name: 'Workbench',
          folderId: folderIds[1],
          bins: [
            ['Drill bits', false],
            ['Hex keys', true],
          ],
        },
      ];
      for (const seed of seeds) {
        const layout = app.createDefaultLayout();
        layout.name = seed.name;
        const bottom = layout.layers[0];
        const top = { ...bottom, id: `${bottom.id}-top`, name: 'Top tray' };
        layout.layers = [bottom, top];
        layout.bins = seed.bins.map(([label, onTop], index) => ({
          id: `${seed.name}-${index}`,
          layerId: onTop ? top.id : bottom.id,
          x: index,
          y: 0,
          width: 1,
          depth: 1,
          height: 3,
          category: layout.categories[0].id,
          label,
          notes: '',
        }));
        const created = await app.createLayoutEntry(layout, library, { name: seed.name });
        if (!created.ok) throw new Error(`Could not create ${seed.name}`);
        const { layoutId } = created.value;
        library = {
          ...created.value.library,
          entries: created.value.library.entries.map((entry) =>
            entry.id === layoutId ? { ...entry, folderId: seed.folderId } : entry
          ),
        };
      }
      await app.saveLibrary(library);
    });
    await page.reload();
    await waitForAppReady(page);
  });

  // Hooks run for a skipped test too, on a page that never left about:blank.
  test.afterEach(async ({ page, viewport }) => {
    if (!isDesktop({ viewport })) return;
    await clearAllStorage(page);
    await resetViewport(page);
  });

  test('finds a bin on the second layer of another layout and lands on it', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('[cmdk-root]');
    await expect(palette).toBeVisible();
    await page.keyboard.type('hex keys');

    const result = palette.getByRole('option', { name: /Hex keys/ });
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toContainText('Garage');
    await expect(result).toContainText('Workbench');
    await expect(result).toContainText('Top tray');
    await result.click();

    await expect(palette).not.toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Workbench');
    await expect(
      page.getByRole('button', { name: 'Select Top tray', pressed: true })
    ).toBeVisible();
    await expect(page.locator('[data-bin-id][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.getByLabel('Bin label', { exact: true })).toHaveValue('Hex keys');
  });
});
