import { DOCS_URL } from './links';

/**
 * The docs section for each panel group, as `/page#heading` under the docs
 * root. `check:user-docs` fails when a page or a heading here goes away.
 */
export const DOCS_SECTIONS = {
  layoutGridSize: '/layouts/drawer-setup',
  layoutPhysicalUnits: '/concepts/units#where-you-set-the-units',
  layoutLayers: '/layouts/layers',
  layoutCategories: '/layouts/categories',
  binShape: '/designer/size-and-shape',
  binLid: '/designer/lids',
  binInterior: '/designer/compartments',
  binBase: '/designer/base',
  baseplateDimensions: '/baseplates/basics#size-the-plate-from-your-layout',
  baseplateBase: '/baseplates/magnets-and-screws',
  baseplatePhysicalUnits: '/baseplates/basics#set-the-x-and-y-grid-pitch',
} as const satisfies Record<string, `/${string}`>;

export type DocsSection = keyof typeof DOCS_SECTIONS;

export function docsSectionHref(section: DocsSection): string {
  return `${DOCS_URL}${DOCS_SECTIONS[section]}`;
}
