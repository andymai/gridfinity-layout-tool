/**
 * The app door's reader: a real layout, read and changed with the app's own
 * code, as the in-app panel does. That code imports the app through `@/`,
 * which this folder's tsconfig cannot resolve, so it loads at run time
 * (`docs:ask-eval` runs tsx with tsconfig.app.json) behind the small types
 * below.
 */
import type {
  MyLayoutData,
  PlanLayoutInput,
  ProposeChangesData,
} from '../../api/lib/agent/index.js';

/** A layout as the app stores it; the eval only passes it between these calls. */
export type AppLayout = { readonly __layout: unique symbol };

type Prepared =
  | { kind: 'preview'; result: { layout: AppLayout; refs: Record<string, string> } }
  | { kind: 'refused'; data: ProposeChangesData }
  | { kind: 'unavailable' };

interface AppCode {
  buildPlanLayout(input: PlanLayoutInput): { ok: boolean; value?: { layout: AppLayout } };
  summarizeLayout(layout: AppLayout): MyLayoutData;
  prepareChanges(open: { id: string; layout: AppLayout } | null, input: unknown): Prepared;
  appliedChanges(refs: Record<string, string>): ProposeChangesData;
}

// Computed paths, so the type-check of this folder does not follow them.
const SOURCES = ['src/shared/plan/buildPlanLayout.ts', 'src/agent/reader/readers.ts'];
const CHANGES = 'src/agent/reader/changes.ts';

let loaded: Promise<AppCode> | null = null;

export function appCode(): Promise<AppCode> {
  loaded ??= (async () => {
    const root = new URL('../../', import.meta.url);
    const [plan, readers, changes] = (await Promise.all(
      [...SOURCES, CHANGES].map((file) => import(new URL(file, root).href))
    )) as [Pick<AppCode, 'buildPlanLayout'>, Pick<AppCode, 'summarizeLayout'>, AppCode];
    return {
      buildPlanLayout: plan.buildPlanLayout,
      summarizeLayout: readers.summarizeLayout,
      prepareChanges: changes.prepareChanges,
      appliedChanges: changes.appliedChanges,
    };
  })();
  return loaded;
}

/** The workbench drawer: 8 x 5, with room left at the back right. */
export const WORKBENCH: PlanLayoutInput = {
  title: 'Workbench drawer',
  grid: { width: 8, depth: 5, height: 9 },
  categories: ['Tools', 'Screws', 'Supplies'],
  bins: [
    { label: 'Pliers', width: 3, depth: 2, height: 3, category: 'Tools' },
    { label: 'Hex keys', width: 3, depth: 1, height: 3, category: 'Tools' },
    { label: 'Tape measure', width: 2, depth: 2, height: 6, category: 'Tools' },
    { label: 'M4 screws', width: 1, depth: 1, height: 3, category: 'Screws' },
    { label: 'M5 screws', width: 1, depth: 1, height: 3, category: 'Screws' },
    { label: 'Glue', width: 2, depth: 1, height: 3, category: 'Supplies' },
    { label: 'Zip ties', width: 2, depth: 2, height: 3, category: 'Supplies' },
  ],
};

/** The open layout's id in the app, which a change set must name. */
export const OPEN_LAYOUT_ID = 'workbench';
