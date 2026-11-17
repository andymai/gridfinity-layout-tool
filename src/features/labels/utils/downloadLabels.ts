import { deliverExport } from '@/shared/exportDestination/deliverExport';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import type { LabelEntry } from '../store/labelListStore';
import { labelFileName, zipLabelFiles } from './labelFiles';
import type { LabelFile } from './labelFiles';
import type { LabelMedia, LabelPrinter } from './labelMedia';
import { renderLabelPng } from './labelPng';
import { labelPaths } from './planLabel';
import type { LabelPlan } from './planLabel';

/**
 * Hand every label that fits to the user's export destination: one PNG on its
 * own, or a ZIP of them. Returns how many labels it saved, and 0 when nothing
 * was saved, which `deliverExport` has already told the user about.
 */
export async function downloadLabels(
  entries: readonly LabelEntry[],
  plans: ReadonlyMap<string, LabelPlan>,
  measurer: TypeMeasurer,
  printer: LabelPrinter,
  media: LabelMedia
): Promise<number> {
  const printable = entries.filter((entry) => plans.get(entry.id)?.fits === true);
  const files: LabelFile[] = [];
  for (const [index, entry] of printable.entries()) {
    const plan = plans.get(entry.id);
    if (!plan) continue;
    files.push({
      name: labelFileName(index, printable.length, entry.name, entry.copies),
      data: await renderLabelPng(plan, labelPaths(plan, measurer), printer.dpi),
    });
  }

  if (files.length === 0) return 0;
  const saved =
    files.length === 1
      ? await deliverExport(
          new Blob([new Uint8Array(files[0].data)], { type: 'image/png' }),
          files[0].name
        )
      : await deliverExport(zipLabelFiles(files), `labels-${printer.id}-${media.id}.zip`);
  return saved ? files.length : 0;
}
