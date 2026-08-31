/**
 * Search index for the bin designer's controls: one entry per `data-help-target`
 * section, carrying the i18n keys the search bar matches and shows. The category
 * a control belongs to is not duplicated here — it comes from `categoryForControl`
 * in the settings manifest, which stays the single source of truth.
 *
 * Reuses the `help.target.binDesigner.*` keys the Help modal already owns for the
 * controls it covers, and adds keys for the ones it does not, so both surfaces
 * draw synonyms from one place.
 */

import type { BinParams } from '@/features/bin-designer/types';

export interface DesignerControlSearchEntry {
  /** The `data-help-target` marker; the argument `jumpToDesignerControl` takes. */
  readonly controlId: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly keywordsKey: string;
}

export const DESIGNER_CONTROL_SEARCH: readonly DesignerControlSearchEntry[] = [
  {
    controlId: 'bd-dimensions',
    titleKey: 'help.target.binDesigner.dimensions.title',
    descriptionKey: 'help.target.binDesigner.dimensions.description',
    keywordsKey: 'help.target.binDesigner.dimensions.keywords',
  },
  {
    controlId: 'bd-overhang',
    titleKey: 'help.target.binDesigner.overhang.title',
    descriptionKey: 'help.target.binDesigner.overhang.description',
    keywordsKey: 'help.target.binDesigner.overhang.keywords',
  },
  {
    controlId: 'bd-shape',
    titleKey: 'help.target.binDesigner.shape.title',
    descriptionKey: 'help.target.binDesigner.shape.description',
    keywordsKey: 'help.target.binDesigner.shape.keywords',
  },
  {
    controlId: 'bd-walls',
    titleKey: 'help.target.binDesigner.walls.title',
    descriptionKey: 'help.target.binDesigner.walls.description',
    keywordsKey: 'help.target.binDesigner.walls.keywords',
  },
  {
    controlId: 'bd-base',
    titleKey: 'help.target.binDesigner.base.title',
    descriptionKey: 'help.target.binDesigner.base.description',
    keywordsKey: 'help.target.binDesigner.base.keywords',
  },
  {
    controlId: 'bd-interior',
    titleKey: 'help.target.binDesigner.interior.title',
    descriptionKey: 'help.target.binDesigner.interior.description',
    keywordsKey: 'help.target.binDesigner.interior.keywords',
  },
  {
    controlId: 'bd-label-tabs',
    titleKey: 'help.target.binDesigner.labelTabs.title',
    descriptionKey: 'help.target.binDesigner.labelTabs.description',
    keywordsKey: 'help.target.binDesigner.labelTabs.keywords',
  },
  {
    controlId: 'bd-scoop',
    titleKey: 'help.target.binDesigner.scoop.title',
    descriptionKey: 'help.target.binDesigner.scoop.description',
    keywordsKey: 'help.target.binDesigner.scoop.keywords',
  },
  {
    controlId: 'bd-knife-rest',
    titleKey: 'help.target.binDesigner.knifeBlock.title',
    descriptionKey: 'help.target.binDesigner.knifeBlock.description',
    keywordsKey: 'help.target.binDesigner.knifeBlock.keywords',
  },
  {
    controlId: 'bd-lid',
    titleKey: 'help.target.binDesigner.lid.title',
    descriptionKey: 'help.target.binDesigner.lid.description',
    keywordsKey: 'help.target.binDesigner.lid.keywords',
  },
  // bd-lid-grip is intentionally omitted: its marker is a bare node inside
  // LidSection that mounts only when the lid is effectively enabled (and is
  // display:none for slide lids), so a search result would dead-end in the
  // common no-lid case. The lid itself (bd-lid) stays searchable and lands the
  // user on the section where the grip lives.
  {
    controlId: 'bd-handles',
    titleKey: 'help.target.binDesigner.handles.title',
    descriptionKey: 'help.target.binDesigner.handles.description',
    keywordsKey: 'help.target.binDesigner.handles.keywords',
  },
  {
    controlId: 'bd-wall-cutouts',
    titleKey: 'help.target.binDesigner.wallCutouts.title',
    descriptionKey: 'help.target.binDesigner.wallCutouts.description',
    keywordsKey: 'help.target.binDesigner.wallCutouts.keywords',
  },
  {
    controlId: 'bd-slide-tray',
    titleKey: 'help.target.binDesigner.slideTray.title',
    descriptionKey: 'help.target.binDesigner.slideTray.description',
    keywordsKey: 'help.target.binDesigner.slideTray.keywords',
  },
  {
    controlId: 'bd-type',
    titleKey: 'help.target.binDesigner.type.title',
    descriptionKey: 'help.target.binDesigner.type.description',
    keywordsKey: 'help.target.binDesigner.type.keywords',
  },
  {
    controlId: 'bd-colors',
    titleKey: 'help.target.binDesigner.colors.title',
    descriptionKey: 'help.target.binDesigner.colors.description',
    keywordsKey: 'help.target.binDesigner.colors.keywords',
  },
  {
    controlId: 'bd-wall-style',
    titleKey: 'help.target.binDesigner.wallStyle.title',
    descriptionKey: 'help.target.binDesigner.wallStyle.description',
    keywordsKey: 'help.target.binDesigner.wallStyle.keywords',
  },
  {
    controlId: 'bd-floor-pattern',
    titleKey: 'help.target.binDesigner.floorPattern.title',
    descriptionKey: 'help.target.binDesigner.floorPattern.description',
    keywordsKey: 'help.target.binDesigner.floorPattern.keywords',
  },
  {
    controlId: 'bd-physical-units',
    titleKey: 'help.target.binDesigner.physicalUnits.title',
    descriptionKey: 'help.target.binDesigner.physicalUnits.description',
    keywordsKey: 'help.target.binDesigner.physicalUnits.keywords',
  },
  {
    controlId: 'bd-print-fit',
    titleKey: 'help.target.binDesigner.printFit.title',
    descriptionKey: 'help.target.binDesigner.printFit.description',
    keywordsKey: 'help.target.binDesigner.printFit.keywords',
  },
];

/**
 * The panel state a control's availability depends on. A control whose section
 * is not currently mounted is left out of results so a jump never dead-ends on
 * the dispatcher's silent 2s timeout.
 */
export interface ControlAvailabilityContext {
  readonly style: BinParams['style'];
  readonly hasText: boolean;
  readonly needsSplit: boolean;
  readonly viewMode: 'scroll' | 'rail';
  /** The `sliding_tray` labs flag — the slide-tray section only mounts when on. */
  readonly slideTrayEnabled: boolean;
}

/**
 * The conditionally-mounted controls; everything else has an always-mounted
 * marker. Label tabs need a standard style; typography needs text on the bin;
 * the slide tray is behind a labs flag; print-fit is view-dependent (the rail's
 * PrintPage always renders it, passive when the bin fits, the scroll panel only
 * when the bin must be split).
 */
export function isDesignerControlAvailable(
  controlId: string,
  ctx: ControlAvailabilityContext
): boolean {
  switch (controlId) {
    case 'bd-label-tabs':
      return ctx.style === 'standard';
    case 'bd-type':
      return ctx.hasText;
    case 'bd-slide-tray':
      return ctx.slideTrayEnabled;
    case 'bd-print-fit':
      return ctx.viewMode === 'rail' || ctx.needsSplit;
    default:
      return true;
  }
}
