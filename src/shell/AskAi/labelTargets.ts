import type { FeatureHelpEntry, HelpTarget } from '@/shared/help/helpEntry';
import { getAllHelpEntries } from '@/shell/Modals/HelpModal/helpEntryAggregator';

/**
 * Labels that Ask AI writes as [[ui:…]], by the i18n key of the text, mapped
 * to a help target that already exists in the layout editor. Only controls
 * that sit inside a target are here; a label without one stays plain text.
 * The help entries' own titles join these at run time.
 */
export const LAYOUT_LABEL_TARGETS: Readonly<Record<string, HelpTarget>> = {
  'sidebar.gridSize': { surface: 'sidebar:grid-size', controlId: 'drawer-size' },
  'sidebar.drawerHeight': { surface: 'sidebar:grid-size', controlId: 'drawer-size' },
  'sidebar.halfBinMode': { surface: 'sidebar:grid-size', controlId: 'half-bin-mode' },
  'common.physicalUnits': { surface: 'sidebar:physical-units', controlId: 'grid-unit' },
  'sidebar.gridUnit': { surface: 'sidebar:physical-units', controlId: 'grid-unit' },
  'sidebar.heightUnit': { surface: 'sidebar:physical-units', controlId: 'height-unit' },
  'sidebar.printBed': { surface: 'sidebar:physical-units', controlId: 'print-bed-size' },
  'common.layers': { surface: 'sidebar:layers', controlId: 'layers-panel' },
  'common.categories': { surface: 'sidebar:categories', controlId: 'categories-panel' },
};

export interface LabelTarget {
  readonly key: string;
  readonly target: HelpTarget;
}

/** Every label key with a target on the layout editor: the table above and the help entries. */
export function layoutLabelTargets(): LabelTarget[] {
  const entries = getAllHelpEntries('layout').filter(
    (entry): entry is FeatureHelpEntry => entry.kind === 'feature'
  );
  return [
    ...Object.entries(LAYOUT_LABEL_TARGETS).map(([key, target]) => ({ key, target })),
    ...entries.map((entry) => ({ key: entry.titleKey, target: entry.target })),
  ];
}

const normal = (text: string): string => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const sameTarget = (a: HelpTarget, b: HelpTarget): boolean =>
  a.surface === b.surface && a.controlId === b.controlId;

/**
 * The one target that a label names, by its text in the app's language or
 * in English. A text that two targets share is ambiguous, so it names none.
 */
export function findLabelTarget(
  label: string,
  targets: readonly LabelTarget[],
  textOf: (key: string) => readonly (string | undefined)[]
): HelpTarget | null {
  const wanted = normal(label);
  if (wanted === '') return null;
  let found: HelpTarget | null = null;
  for (const { key, target } of targets) {
    if (!textOf(key).some((text) => text !== undefined && normal(text) === wanted)) continue;
    if (found && !sameTarget(found, target)) return null;
    found = target;
  }
  return found;
}
