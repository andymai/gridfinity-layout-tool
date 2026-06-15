/**
 * Help entries owned by the bin-designer feature. Surfaced in the global
 * Help modal search via `helpEntryAggregator` whenever the user is on the
 * bin-designer route.
 *
 * Each target.surface is one of:
 *   - 'binDesigner:shape'    — Shape group (dimensions, shape, walls, lid)
 *   - 'binDesigner:interior' — Interior dividers, label tabs, scoop
 *   - 'binDesigner:base'     — Base attachments, multi-color, physical units
 *
 * The ParameterPanel listens for `help-jump:binDesigner:*` events and
 * expands the corresponding StickyGroupHeader before the dispatcher
 * scrolls + pulses the target control.
 */

import type { FeatureHelpEntry } from '@/shared/help/helpEntry';

export const helpEntries: FeatureHelpEntry[] = [
  {
    id: 'feature/bin-designer/dimensions',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.dimensions.title',
    descriptionKey: 'help.target.binDesigner.dimensions.description',
    keywordsKey: 'help.target.binDesigner.dimensions.keywords',
    category: 'shape',
    routes: ['designer'],
    target: { surface: 'binDesigner:shape', controlId: 'bd-dimensions' },
  },
  {
    id: 'feature/bin-designer/shape',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.shape.title',
    descriptionKey: 'help.target.binDesigner.shape.description',
    keywordsKey: 'help.target.binDesigner.shape.keywords',
    category: 'shape',
    routes: ['designer'],
    target: { surface: 'binDesigner:shape', controlId: 'bd-shape' },
  },
  {
    id: 'feature/bin-designer/walls',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.walls.title',
    descriptionKey: 'help.target.binDesigner.walls.description',
    keywordsKey: 'help.target.binDesigner.walls.keywords',
    category: 'shape',
    routes: ['designer'],
    target: { surface: 'binDesigner:shape', controlId: 'bd-walls' },
  },
  {
    id: 'feature/bin-designer/lid',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.lid.title',
    descriptionKey: 'help.target.binDesigner.lid.description',
    keywordsKey: 'help.target.binDesigner.lid.keywords',
    category: 'shape',
    routes: ['designer'],
    target: { surface: 'binDesigner:shape', controlId: 'bd-lid' },
  },
  {
    id: 'feature/bin-designer/colors',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.colors.title',
    descriptionKey: 'help.target.binDesigner.colors.description',
    keywordsKey: 'help.target.binDesigner.colors.keywords',
    category: 'colors',
    routes: ['designer'],
    target: { surface: 'binDesigner:base', controlId: 'bd-colors' },
  },
  {
    id: 'feature/bin-designer/interior',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.interior.title',
    descriptionKey: 'help.target.binDesigner.interior.description',
    keywordsKey: 'help.target.binDesigner.interior.keywords',
    category: 'interior',
    routes: ['designer'],
    target: { surface: 'binDesigner:interior', controlId: 'bd-interior' },
  },
  // NOTE: Label tab entry deferred — the bd-label-tabs marker only mounts
  // when `params.style === 'standard'`. With static `routes` filtering we'd
  // either need conditional entries (runtime predicate) or to always mount
  // the marker. Re-add when we ship runtime-conditional entry support.
  {
    id: 'feature/bin-designer/scoop',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.scoop.title',
    descriptionKey: 'help.target.binDesigner.scoop.description',
    keywordsKey: 'help.target.binDesigner.scoop.keywords',
    category: 'interior',
    routes: ['designer'],
    target: { surface: 'binDesigner:interior', controlId: 'bd-scoop' },
  },
  {
    id: 'feature/bin-designer/base',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.base.title',
    descriptionKey: 'help.target.binDesigner.base.description',
    keywordsKey: 'help.target.binDesigner.base.keywords',
    category: 'base',
    routes: ['designer'],
    target: { surface: 'binDesigner:base', controlId: 'bd-base' },
  },
  {
    id: 'feature/bin-designer/physical-units',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.physicalUnits.title',
    descriptionKey: 'help.target.binDesigner.physicalUnits.description',
    keywordsKey: 'help.target.binDesigner.physicalUnits.keywords',
    category: 'base',
    routes: ['designer'],
    target: { surface: 'binDesigner:base', controlId: 'bd-physical-units' },
  },
  {
    id: 'feature/bin-designer/print-bed-size',
    kind: 'feature',
    titleKey: 'help.target.binDesigner.printBedSize.title',
    descriptionKey: 'help.target.binDesigner.printBedSize.description',
    keywordsKey: 'help.target.binDesigner.printBedSize.keywords',
    category: 'base',
    routes: ['designer'],
    target: { surface: 'binDesigner:base', controlId: 'bd-physical-units' },
  },
];
