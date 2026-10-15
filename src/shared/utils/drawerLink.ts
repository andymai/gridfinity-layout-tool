import { CONSTRAINTS } from '@/core/constants';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { err, ok, validationImportFailed } from '@/core/result';
import type { Result, ValidationError } from '@/core/result';
import type { Layout, LayoutLibrary } from '@/core/types';
import { effectiveGridUnitMmY, gridUnits, heightUnits, mm } from '@/core/types';
import { fitAxisUnits, measuredHeightUnits } from './drawerFit';

/**
 * A drawer described by its interior millimetres, carried in a URL such as
 * `/?drawer=297x525x60&name=IKEA%20Alex`. Content pages and the calculator
 * link here, so the format is public and must stay readable.
 */
export interface DrawerLinkSpec {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm?: number;
  readonly name?: string;
}

export const DRAWER_LINK_PARAM = 'drawer';
export const DRAWER_LINK_NAME_PARAM = 'name';

const NUMBER = '(\\d+(?:\\.\\d+)?)';
const SIZE_PATTERN = new RegExp(`^${NUMBER}[x×]${NUMBER}(?:[x×]${NUMBER})?$`, 'i');

function cleanName(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const cleaned = raw
    .replace(/\p{Cc}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
  return cleaned === '' ? undefined : cleaned;
}

/**
 * Reads a drawer link from a query string. `null` means the URL carries no
 * drawer at all; an error means it carries one the planner cannot use.
 */
export function parseDrawerLink(search: string): Result<DrawerLinkSpec, ValidationError> | null {
  const params = new URLSearchParams(search);
  const raw = params.get(DRAWER_LINK_PARAM);
  if (raw === null) return null;

  const match = SIZE_PATTERN.exec(raw.trim());
  if (match === null) {
    return err(validationImportFailed([`Unrecognised drawer size "${raw}"`]));
  }
  const [, width, depth, height] = match;
  const widthMm = Number(width);
  const depthMm = Number(depth);
  // An unmatched optional group is undefined at runtime though typed string.
  const heightMm = height ? Number(height) : undefined;
  // The sync and share servers reject a measurement outside these bounds, so
  // a layout built from one could never leave this device.
  const measurable = (value: number): boolean =>
    value >= CONSTRAINTS.MEASURED_MM_MIN && value <= CONSTRAINTS.MEASURED_MM_MAX;
  if (
    !measurable(widthMm) ||
    !measurable(depthMm) ||
    (heightMm !== undefined && !measurable(heightMm))
  ) {
    return err(validationImportFailed([`Drawer size "${raw}" is outside the measurable range`]));
  }

  const name = cleanName(params.get(DRAWER_LINK_NAME_PARAM));
  return ok({
    widthMm,
    depthMm,
    ...(heightMm !== undefined ? { heightMm } : {}),
    ...(name !== undefined ? { name } : {}),
  });
}

const halfOf = (slackMm: number): number => Math.floor((slackMm / 2) * 100) / 100;

/**
 * The layout a drawer link opens: whole grid units that fit inside the drawer,
 * the measurement kept beside them, and the leftover split evenly into
 * baseplate padding the way the baseplate panel's mm entry splits it.
 *
 * `base` must hold a single layer, as a fresh layout does; only that layer is
 * capped to the drawer height.
 */
export function buildDrawerLinkLayout(
  base: Layout,
  spec: DrawerLinkSpec,
  fallbackName: string
): Result<Layout, ValidationError> {
  const pitchX = base.gridUnitMm;
  const pitchY = effectiveGridUnitMmY(base);
  const fitsGrid = (sizeMm: number, pitch: number): boolean =>
    sizeMm >= pitch && sizeMm <= CONSTRAINTS.GRID_MAX * pitch;
  if (!fitsGrid(spec.widthMm, pitchX) || !fitsGrid(spec.depthMm, pitchY)) {
    return err(
      validationImportFailed([
        `Drawer ${spec.widthMm} × ${spec.depthMm} mm is outside 1 to ${CONSTRAINTS.GRID_MAX} grid units`,
      ])
    );
  }

  const width = fitAxisUnits(spec.widthMm, pitchX, false);
  const depth = fitAxisUnits(spec.depthMm, pitchY, false);
  const drawerHeight =
    spec.heightMm !== undefined
      ? measuredHeightUnits(spec.heightMm, base.heightUnitMm)
      : base.drawer.height;
  const layerCap = Math.max(CONSTRAINTS.MIN_LAYER_HEIGHT, Math.floor(drawerHeight));

  const padX = halfOf(width.slackMm);
  const padY = halfOf(depth.slackMm);

  return ok({
    ...base,
    name: spec.name ?? fallbackName,
    drawer: {
      width: gridUnits(width.units),
      depth: gridUnits(depth.units),
      height: heightUnits(drawerHeight),
      measuredMm: {
        width: spec.widthMm,
        depth: spec.depthMm,
        ...(spec.heightMm !== undefined ? { height: spec.heightMm } : {}),
      },
    },
    layers: base.layers.map((layer, index) =>
      index === 0 ? { ...layer, height: heightUnits(Math.min(layer.height, layerCap)) } : layer
    ),
    baseplateParams: {
      ...(base.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS),
      syncWithLayout: true,
      paddingLeft: mm(padX),
      paddingRight: mm(padX),
      paddingFront: mm(padY),
      paddingBack: mm(padY),
    },
  });
}

/**
 * True for the empty layout a first visit seeds: the library's only entry,
 * created by this page load's initialization, still without bins. A drawer
 * link sizes that layout instead of leaving it behind as an empty extra.
 */
export function isFirstVisitLayout(
  library: LayoutLibrary,
  layout: Layout,
  seededThisLoad: boolean
): boolean {
  if (!seededThisLoad || library.entries.length !== 1) return false;
  const [only] = library.entries;
  return (
    only.id === library.activeLayoutId && layout.bins.length === 0 && layout.layers.length === 1
  );
}

/** Drops the drawer link from the address bar so a reload does not reapply it. */
export function clearDrawerLinkFromURL(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(DRAWER_LINK_PARAM);
  url.searchParams.delete(DRAWER_LINK_NAME_PARAM);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
