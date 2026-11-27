import type { DesignStorePort } from '@/core/storage/designStorePort';
import { isOk } from '@/core/result';
import type { Layout, LayoutEntry } from '@/core/types';
import { inYear, yearBounds } from '@/shared/yearReview/yearWork';
import type { YearDesignSource, YearLayoutSource } from '../types';

export interface YearSourceDeps {
  readonly entries: readonly LayoutEntry[];
  /** Storage can lag auto-save, so the open layout comes from the editor store. */
  readonly active: { readonly id: string; readonly layout: Layout } | null;
  readonly loadLayout: (id: string) => Promise<Layout | null>;
  readonly port: Pick<DesignStorePort, 'listDesignSummaries'> | null;
}

export interface YearSources {
  readonly layouts: readonly YearLayoutSource[];
  readonly designs: readonly YearDesignSource[];
}

/** Loads only drawers started in the year, one at a time, as Places Find does. */
export async function loadYearSources(year: number, deps: YearSourceDeps): Promise<YearSources> {
  const bounds = yearBounds(year);
  const layouts: YearLayoutSource[] = [];
  for (const entry of deps.entries) {
    if (!inYear(entry.createdAt, bounds)) continue;
    const layout =
      deps.active?.id === entry.id ? deps.active.layout : await deps.loadLayout(entry.id);
    if (!layout) continue;
    layouts.push({
      id: entry.id,
      name: entry.name,
      createdAt: entry.createdAt,
      modifiedAt: entry.modifiedAt,
      layout,
    });
  }

  const listed = deps.port ? await deps.port.listDesignSummaries() : null;
  const designs: YearDesignSource[] = listed && isOk(listed) ? [...listed.value] : [];
  return { layouts, designs };
}
