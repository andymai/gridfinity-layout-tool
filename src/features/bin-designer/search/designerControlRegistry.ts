/**
 * The bin designer's search index, in two layers:
 *
 * - `DESIGNER_CONTROL_SEARCH` — one record per `data-help-target` SECTION, with
 *   i18n title/description/synonyms. These are the browse-level entries.
 * - `DESIGNER_OPTION_RECORDS` — finer sub-options inside those sections
 *   (Lightweight floor, Screw holes, Lid grip, …). Each reuses an existing
 *   translated label key and carries English-only synonyms, so richer coverage
 *   costs no new translation. An option's `section` is both its breadcrumb
 *   parent and its jump target: only section-level markers exist in the DOM, so
 *   selecting an option lands the user on the section that holds it.
 *
 * A control's category is not duplicated here — it comes from `categoryForControl`
 * in the settings manifest, the single source of truth.
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

export interface DesignerOptionRecord {
  /** Unique id (also the React key for the result row). */
  readonly id: string;
  /** An existing, already-translated i18n key for the visible label. */
  readonly labelKey: string;
  /** The owning section's controlId — the breadcrumb parent and the jump target. */
  readonly section: string;
  /** English-only, match-only synonyms; never displayed, so they need no locale. */
  readonly keywords: readonly string[];
}

/**
 * Finer sub-options, curated to the terms users actually type. Labels reuse
 * existing translated keys; synonyms are English (domain terms stay English in
 * every locale anyway). Add an entry here, and its coverage is pinned by the
 * golden-set eval in `searchCoverage.test.tsx`.
 */
export const DESIGNER_OPTION_RECORDS: readonly DesignerOptionRecord[] = [
  // Base
  {
    id: 'opt-lightweight',
    labelKey: 'binDesigner.lightweight',
    section: 'bd-base',
    keywords: [
      'lightweight',
      'lightweight floor',
      'weight savings',
      'honeycomb',
      'infill',
      'hollow',
      'gyroid',
    ],
  },
  {
    id: 'opt-stacking-lip',
    labelKey: 'assembledHeight.stackingLip',
    section: 'bd-base',
    keywords: ['stacking lip', 'stack', 'lip', 'rim', 'stackable', 'mating'],
  },
  {
    id: 'opt-magnets',
    labelKey: 'binDesigner.base.magnetHoles',
    section: 'bd-base',
    keywords: ['magnet', 'magnets', 'magnetic', 'magnet holes', 'hold down', 'mount'],
  },
  {
    id: 'opt-screws',
    labelKey: 'binDesigner.base.screwHoles',
    section: 'bd-base',
    keywords: ['screw', 'screws', 'screw holes', 'mounting', 'fasten', 'countersink'],
  },
  {
    id: 'opt-detachable-feet',
    labelKey: 'binDesigner.detachableFeet',
    section: 'bd-base',
    keywords: ['detachable feet', 'removable feet', 'pin feet', 'snap feet', 'modular feet'],
  },
  {
    id: 'opt-half-sockets',
    labelKey: 'binDesigner.halfSockets',
    section: 'bd-base',
    keywords: ['half sockets', 'half grid feet', 'half pockets'],
  },
  {
    id: 'opt-foot-lattice',
    labelKey: 'binDesigner.footLattice',
    section: 'bd-base',
    keywords: ['foot lattice', 'foot layout', 'foot pattern'],
  },
  {
    id: 'opt-flat-base',
    labelKey: 'binDesigner.flatFloor',
    section: 'bd-base',
    keywords: ['flat base', 'flat bottom', 'no feet', 'solid base'],
  },
  {
    id: 'opt-spacer',
    labelKey: 'binDesigner.spacer',
    section: 'bd-base',
    keywords: ['spacer', 'filler', 'riser', 'shim', 'gap filler'],
  },
  {
    id: 'opt-base-only',
    labelKey: 'binDesigner.tile',
    section: 'bd-base',
    keywords: ['base only', 'tile', 'plate', 'foot tile'],
  },
  {
    id: 'opt-lid-base',
    labelKey: 'binDesigner.lidBottom',
    section: 'bd-base',
    keywords: ['lid base', 'tray bottom', 'matching tray'],
  },
  // Lid
  {
    id: 'opt-lid-attachment',
    labelKey: 'binDesigner.lid.attachment',
    section: 'bd-lid',
    keywords: [
      'attachment',
      'friction',
      'click rails',
      'magnetic lid',
      'slide lid',
      'hinged',
      'snap',
      'flip',
    ],
  },
  {
    id: 'opt-lid-grip',
    labelKey: 'help.target.binDesigner.lidGrip.title',
    section: 'bd-lid',
    keywords: [
      'grip',
      'pry',
      'thumb',
      'chamfer',
      'shadow line',
      'scallop',
      'notch',
      'open lid',
      'remove lid',
      'fingernail',
    ],
  },
  {
    id: 'opt-lid-top-surface',
    labelKey: 'binDesigner.lid.section.topSurface',
    section: 'bd-lid',
    keywords: ['top surface', 'flat top', 'stackable top', 'tray top', 'recessed'],
  },
  {
    id: 'opt-lid-extra-height',
    labelKey: 'binDesigner.lid.extraHeight',
    section: 'bd-lid',
    keywords: ['extra lid height', 'deeper lid', 'cavity', 'headroom'],
  },
  // Walls
  {
    id: 'opt-wall-thickness',
    labelKey: 'binDesigner.wallThickness',
    section: 'bd-walls',
    keywords: ['wall thickness', 'thickness', 'wall width', 'perimeters'],
  },
  {
    id: 'opt-wall-text',
    labelKey: 'binDesigner.walls.text.heading',
    section: 'bd-wall-style',
    keywords: ['wall text', 'engrave walls', 'emboss', 'sign', 'caption'],
  },
  // Interior
  {
    id: 'opt-interior-bento',
    labelKey: 'binDesigner.interior.bento.title',
    section: 'bd-interior',
    keywords: ['bento', 'freeform', 'custom sizes', 'mixed compartments'],
  },
  {
    id: 'opt-interior-slotted',
    labelKey: 'binDesigner.interior.slotted.title',
    section: 'bd-interior',
    keywords: ['removable dividers', 'slotted', 'slots', 'adjustable dividers'],
  },
  {
    id: 'opt-interior-solid',
    labelKey: 'binDesigner.interior.solid.title',
    section: 'bd-interior',
    keywords: ['solid', 'cutout', 'pockets', 'custom shapes'],
  },
  {
    id: 'opt-interior-grid',
    labelKey: 'binDesigner.interior.standard.title',
    section: 'bd-interior',
    keywords: ['grid dividers', 'compartments', 'rows', 'columns'],
  },
  // Label tabs
  {
    id: 'opt-label-support',
    labelKey: 'binDesigner.tabSupport',
    section: 'bd-label-tabs',
    keywords: ['bracket', 'solid', 'fillet', 'underhang', 'tab support'],
  },
  {
    id: 'opt-label-mode',
    labelKey: 'binDesigner.tabMode',
    section: 'bd-label-tabs',
    keywords: ['engraved', 'socket', 'plate', 'label style'],
  },
  {
    id: 'opt-label-edges',
    labelKey: 'binDesigner.tabEdges',
    section: 'bd-label-tabs',
    keywords: ['front', 'back', 'both ends', 'tab placement'],
  },
  // Dimensions
  {
    id: 'opt-half-grid',
    labelKey: 'binDesigner.halfBinMode',
    section: 'bd-dimensions',
    keywords: ['half grid', 'half bin', 'half unit', 'fractional', 'half size'],
  },
  {
    id: 'opt-extra-wall-height',
    labelKey: 'binDesigner.extraWallHeight',
    section: 'bd-dimensions',
    keywords: ['extra wall height', 'collar', 'taller walls', 'headroom'],
  },
  {
    id: 'opt-fractional-edge',
    labelKey: 'sidebar.halfUnitEdgePosition',
    section: 'bd-dimensions',
    keywords: ['fractional edge', 'half foot side', 'edge offset'],
  },
  // Overhang
  {
    id: 'opt-taper',
    labelKey: 'binDesigner.overhang.taper.title',
    section: 'bd-overhang',
    keywords: ['taper', 'flare', 'angled walls', 'draft'],
  },
  // Shape
  {
    id: 'opt-custom-shape',
    labelKey: 'binDesigner.shape.customShape',
    section: 'bd-shape',
    keywords: [
      'custom shape',
      'l shape',
      't shape',
      'u shape',
      'footprint',
      'non-rectangular',
      'notch',
    ],
  },
  // Type
  {
    id: 'opt-font',
    labelKey: 'binDesigner.type.font',
    section: 'bd-type',
    keywords: ['font', 'typeface', 'family'],
  },
  {
    id: 'opt-text-mode',
    labelKey: 'binDesigner.textMode',
    section: 'bd-type',
    keywords: ['engrave', 'emboss', 'through cut', 'deboss', 'raised', 'stencil'],
  },
  // Physical units
  {
    id: 'opt-grid-unit',
    labelKey: 'binDesigner.gridUnit',
    section: 'bd-physical-units',
    keywords: ['grid unit', 'cell size', 'pitch', 'module'],
  },
  {
    id: 'opt-height-unit',
    labelKey: 'binDesigner.heightUnit',
    section: 'bd-physical-units',
    keywords: ['height unit', 'z unit'],
  },
  {
    id: 'opt-nozzle',
    labelKey: 'settings.nozzleSize',
    section: 'bd-physical-units',
    keywords: ['nozzle', 'line width'],
  },
  // Print split
  {
    id: 'opt-split-connectors',
    labelKey: 'binDesigner.splitConnectors',
    section: 'bd-print-fit',
    keywords: ['split', 'connectors', 'dowel', 'pin', 'alignment', 'registration'],
  },
  {
    id: 'opt-wall-connectors',
    labelKey: 'binDesigner.splitWallConnectors',
    section: 'bd-print-fit',
    keywords: ['wall connectors', 'key', 'joint', 'glue joint', 'lock'],
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
