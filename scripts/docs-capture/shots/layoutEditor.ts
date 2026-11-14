import type { Locator, Page } from '@playwright/test';
import { layoutFile } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { union } from '../session';
import type { DocsSession, Rect } from '../session';

export const grid = (page: Page): Locator => page.locator('[role="application"]').first();

/** Opens the layout editor on `fixtures`, the last one active. */
export async function openLayouts(s: DocsSession, ...fixtures: FixtureLayout[]): Promise<void> {
  await s.open('/', grid);
  await s.importLayouts(fixtures.map(layoutFile), grid);
}

/**
 * Screen centre of a grid cell, 1-based, row 1 at the front (the bottom of the
 * grid), read off the row and column header buttons.
 */
export async function cellCenter(
  s: DocsSession,
  col: number,
  row: number
): Promise<[number, number]> {
  const c = await s.box(
    s.page.getByRole('button', {
      name: label('grid.selectColumnAria', { column: col }),
      exact: true,
    })
  );
  const r = await s.box(
    s.page.getByRole('button', { name: label('grid.selectRowAria', { row }), exact: true })
  );
  return [c.x + c.width / 2, r.y + r.height / 2];
}

/** The grid with its row and column numbers, for a layout of `width` x `depth` cells. */
export async function gridArea(s: DocsSession, width: number, depth: number): Promise<Rect> {
  const header = (key: 'grid.selectColumnAria' | 'grid.selectRowAria', n: number): Promise<Rect> =>
    s.box(
      s.page.getByRole('button', {
        name: label(key, key === 'grid.selectColumnAria' ? { column: n } : { row: n }),
        exact: true,
      })
    );
  return union(
    await s.box(grid(s.page)),
    await header('grid.selectColumnAria', 1),
    await header('grid.selectColumnAria', width),
    await header('grid.selectRowAria', 1),
    await header('grid.selectRowAria', depth)
  );
}
