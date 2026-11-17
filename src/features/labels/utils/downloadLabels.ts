import { triggerDownload } from '@/shared/generation/exportUtils';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import type { LabelEntry } from '../store/labelListStore';
import { labelFileName, zipLabelFiles } from './labelFiles';
import type { LabelFile } from './labelFiles';
import type { LabelMedia, LabelPrinter } from './labelMedia';
import { renderLabelPng } from './labelPng';
import { labelPaths } from './planLabel';
import type { LabelPlan } from './planLabel';

/**
 * Download every label that fits: one PNG on its own, or a ZIP of them.
 * Returns how many labels it wrote.
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

  if (files.length === 1) {
    triggerDownload(
      new Blob([new Uint8Array(files[0].data)], { type: 'image/png' }),
      files[0].name
    );
  } else if (files.length > 1) {
    triggerDownload(zipLabelFiles(files), `labels-${printer.id}-${media.id}.zip`);
  }
  return files.length;
}
