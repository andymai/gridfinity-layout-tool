/** Help-jump wiring for the scroll panel's anatomical groups. */

import type { PanelGroup } from '../groupModified';

/** The help surfaces the groups listen on, plus the umbrella surface. */
export const HELP_SURFACES = [
  'binDesigner',
  'binDesigner:shape',
  'binDesigner:interior',
  'binDesigner:base',
  'binDesigner:lid',
  'binDesigner:finishing',
] as const;

/**
 * Which group owns a help-jump target, so a deep link opens the right one. The
 * anatomical grouping differs from the rail's task categories, so this cannot
 * reuse `categoryForControl`; a test pins it to cover every `DESIGNER_SETTINGS`
 * control, since a target missing here silently fails to open its group.
 */
export const GROUP_OF_CONTROL: Readonly<Record<string, PanelGroup>> = {
  'bd-dimensions': 'shape',
  'bd-overhang': 'shape',
  'bd-shape': 'shape',
  'bd-walls': 'shape',
  'bd-wall-cutouts': 'shape',
  'bd-print-fit': 'shape',
  'bd-lid': 'lid',
  'bd-lid-grip': 'lid',
  'bd-handles': 'lid',
  'bd-interior': 'interior',
  'bd-label-tabs': 'interior',
  'bd-scoop': 'interior',
  'bd-knife-rest': 'interior',
  'bd-slide-tray': 'interior',
  'bd-base': 'base',
  'bd-type': 'finishing',
  'bd-colors': 'finishing',
  'bd-wall-style': 'finishing',
  'bd-floor-pattern': 'finishing',
  'bd-physical-units': 'finishing',
};
