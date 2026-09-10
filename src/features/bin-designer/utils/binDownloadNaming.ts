import { GITHUB_ISSUES_URL } from '@/shared/constants/links';
import type { BinParams, ExportFileFormat } from '@/features/bin-designer/types';

/** Map piece labels from the worker to descriptive display names for 3MF/STEP. */
export function formatPieceDisplayName(
  label: string,
  params: { width: number; depth: number; height: number }
): string {
  const dims = `${params.width}x${params.depth}x${params.height}`;
  switch (label) {
    case 'bin':
      return `Bin ${dims}`;
    case 'lid':
      return `Lid ${dims}`;
    case 'lid-baseplate':
      return `Lid Baseplate ${dims}`;
    case 'slide-tray':
      return `Sliding Tray ${dims}`;
    case 'feet':
      return `Feet ${dims}`;
    case 'knife-rest':
      return `Handle Rest ${dims}`;
    case 'divider-horizontal':
      return 'Divider Horizontal';
    case 'divider-vertical':
      return 'Divider Vertical';
    case 'assembly':
      return `Bin ${dims} Assembly`;
    default:
      return label;
  }
}

/**
 * Build a GitHub issue URL with bin params + error class prefilled. Lets the
 * "Report issue" toast action drop users into a complete bug report instead
 * of asking them to copy/paste failure context.
 *
 * The snapshot covers every BinParams field that materially affects the
 * generated solid (so reports are reproducible). Fields added carelessly
 * here will balloon the URL — keep the shape compact and prefer counts /
 * enabled flags over full nested config when the nested data is large.
 */
export function buildReportIssueUrl(
  params: BinParams,
  error: Error,
  format: ExportFileFormat
): string {
  const title = `Bin export failed: ${error.name || 'Error'}`;
  const body = [
    '**Format:** ' + format.toUpperCase(),
    '**Error:** ' + error.message,
    '',
    '**Bin params:**',
    '```json',
    JSON.stringify(
      {
        width: params.width,
        depth: params.depth,
        height: params.height,
        gridUnitMm: params.gridUnitMm,
        heightUnitMm: params.heightUnitMm,
        wallThickness: params.wallThickness,
        style: params.style,
        base: { style: params.base.style, stackingLip: params.base.stackingLip },
        compartments: {
          cols: params.compartments.cols,
          rows: params.compartments.rows,
          // Duplicate IDs = at least two cells share a compartment. Robust
          // against renumbered-but-unmerged designs (where a positional
          // `id !== i` check would false-positive).
          merged: new Set(params.compartments.cells).size !== params.compartments.cells.length,
        },
        scoop: params.scoop.enabled
          ? {
              enabled: true,
              radius: params.scoop.radius,
              run: params.scoop.run,
              style: params.scoop.style,
              autoMaxHeight: params.scoop.autoMaxHeight,
            }
          : false,
        label: params.label.enabled
          ? { enabled: true, support: params.label.support, depth: params.label.depth }
          : false,
        wallPattern: params.wallPattern.enabled ? params.wallPattern.pattern : null,
        walls: params.walls.enabled ? { shape: params.walls.shape } : false,
        handles: params.handles.enabled,
        cutouts: params.cutouts.length,
        inserts: params.inserts.length,
        lid: params.lid.enabled,
        featureColors: params.featureColors.enabled,
      },
      null,
      2
    ),
    '```',
  ].join('\n');
  const url = new URL(`${GITHUB_ISSUES_URL}/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  url.searchParams.set('labels', 'bin-export-failure');
  return url.toString();
}
