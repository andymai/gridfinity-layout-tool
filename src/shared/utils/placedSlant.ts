import type { Bin, DesignId, DesignSlantFacts, FractionalEdge, Layout, Rect } from '@/core/types';
import { effectiveGridUnitMmY, gridUnits } from '@/core/types';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { footprintsOverlap } from './collision';
import { resolveBinOverhang } from './drawerMargin';
import { edgeForPosition } from './fractionalEdge';
import { isTurnedPlacement, sideInPlacement } from './placementTurn';
import {
  planSupportFor,
  slantPlanFor,
  slantSpanZFor,
  type SlantPlan,
  type SlantSupportPlan,
} from './slantPlan';

export interface LinkedSlantFacts extends DesignSlantFacts {
  /** The design's own size, which a turned or not yet resynced placement can differ from. */
  readonly width?: number;
  readonly depth?: number;
  readonly height?: number;
  /** The base has no socket, so the lean starts at the bed. */
  readonly flatBase?: boolean;
  readonly fractionalEdgeX?: FractionalEdge;
  readonly fractionalEdgeY?: FractionalEdge;
}

/**
 * Registered from the shell, because the facts live in the bin-designer
 * registry. Undefined for a design the registry does not know, whose placed
 * slant then applies on its own.
 */
export type LinkedSlantResolver = (designId: DesignId) => LinkedSlantFacts | undefined;

let linkedSlantResolver: LinkedSlantResolver | null = null;

export function registerLinkedSlantResolver(resolver: LinkedSlantResolver | null): void {
  linkedSlantResolver = resolver;
}

export type SlantLayout = Pick<
  Layout,
  'drawer' | 'baseplateParams' | 'gridUnitMm' | 'gridUnitMmY' | 'heightUnitMm' | 'lowProfileBase'
>;

export interface PlacedSlant {
  readonly plan: SlantPlan;
  /** The cells the end support stands on, past the lean side; null without one. */
  readonly support: Rect | null;
}

function supportRect(bin: Bin, support: SlantSupportPlan): Rect {
  const length = support.lengthU;
  switch (support.slant.side) {
    case 'back':
      return {
        x: bin.x,
        y: gridUnits(bin.y + bin.depth),
        width: bin.width,
        depth: gridUnits(length),
      };
    case 'front':
      return { x: bin.x, y: gridUnits(bin.y - length), width: bin.width, depth: gridUnits(length) };
    case 'right':
      return {
        x: gridUnits(bin.x + bin.width),
        y: bin.y,
        width: gridUnits(length),
        depth: bin.depth,
      };
    case 'left':
      return { x: gridUnits(bin.x - length), y: bin.y, width: gridUnits(length), depth: bin.depth };
  }
}

const otherEdge = (edge: FractionalEdge | undefined): FractionalEdge | undefined =>
  edge === undefined ? undefined : edge === 'end' ? 'start' : 'end';

/** The linked design's facts, facing the drawer the way the bin stands. */
function placementFacts(bin: Bin): LinkedSlantFacts | undefined {
  const facts =
    bin.linkedDesignId !== undefined ? linkedSlantResolver?.(bin.linkedDesignId) : undefined;
  if (facts?.width === undefined || facts.depth === undefined) return facts;
  if (!isTurnedPlacement(bin, { width: facts.width, depth: facts.depth })) return facts;
  return {
    ...facts,
    ...(facts.config
      ? { config: { ...facts.config, side: sideInPlacement(facts.config.side) } }
      : {}),
    // The quarter turn carries the design's +X side to the back and its +Y side to the left.
    fractionalEdgeX: otherEdge(facts.fractionalEdgeY),
    fractionalEdgeY: facts.fractionalEdgeX,
    ...(facts.gridUnitMmY !== undefined
      ? {
          gridUnitMm: facts.gridUnitMmY,
          gridUnitMmY: facts.gridUnitMm ?? CONSTRAINTS.GRID_UNIT_MM_DEFAULT,
        }
      : {}),
  };
}

/**
 * The slant a placed bin is exported with: its own, else its design's, unless
 * the design or the bin's own overhang keeps it upright, as the layout export
 * decides.
 */
export function placedSlant(bin: Bin, layout: SlantLayout): PlacedSlant | null {
  const facts = placementFacts(bin);
  if (facts?.blocked) return null;
  const plan = slantPlanFor(bin.slant ?? facts?.config);
  if (!plan) return null;
  if (resolveBinOverhang(bin, layout.drawer, layout.baseplateParams) !== null) return null;
  if (!plan.endSupport) return { plan, support: null };

  // The export builds a linked design at its own height and in its own units,
  // which a placement keeps until the next resync and the layout's can differ from.
  const units = facts
    ? {
        gridUnitMm: facts.gridUnitMm ?? CONSTRAINTS.GRID_UNIT_MM_DEFAULT,
        gridUnitMmY: facts.gridUnitMmY ?? facts.gridUnitMm ?? CONSTRAINTS.GRID_UNIT_MM_DEFAULT,
        heightUnitMm: facts.heightUnitMm ?? CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT,
      }
    : {
        gridUnitMm: layout.gridUnitMm,
        gridUnitMmY: effectiveGridUnitMmY(layout),
        heightUnitMm: layout.heightUnitMm,
      };
  const span = slantSpanZFor({
    flatBase: facts?.flatBase === true,
    lowProfile: layout.lowProfileBase === true,
    height: facts?.height ?? bin.height,
    heightUnitMm: units.heightUnitMm,
    extraWallHeightMm: facts?.extraWallMm,
  });
  const support = planSupportFor(plan, {
    ...span,
    width: bin.width,
    depth: bin.depth,
    fractionalEdgeX:
      facts?.fractionalEdgeX ??
      edgeForPosition(bin.x, layout.drawer.width, layout.drawer.fractionalEdgeX),
    fractionalEdgeY:
      facts?.fractionalEdgeY ??
      edgeForPosition(bin.y, layout.drawer.depth, layout.drawer.fractionalEdgeY),
    gridUnitMm: units.gridUnitMm,
    gridUnitMmY: units.gridUnitMmY,
  });
  return { plan, support: support ? supportRect(bin, support) : null };
}

/** The bin's footprint, plus its end support's cells when it has one. */
export function slantZone(bin: Bin, layout: SlantLayout): { slanted: boolean; rects: Rect[] } {
  const slant = placedSlant(bin, layout);
  return {
    slanted: slant !== null,
    rects: slant?.support ? [bin, slant.support] : [bin],
  };
}

export interface SlantConflict {
  readonly kind: 'collision' | 'stacked';
  readonly with: Bin;
}

function overlapsAny(a: readonly Rect[], b: readonly Rect[]): boolean {
  return a.some((r) => b.some((s) => footprintsOverlap(r, s)));
}

/**
 * Where `candidate`, slanted as `own`, breaks a slanted bin's room: an end
 * support on another bin's cells, or anything on another layer over or under a
 * slanted bin and its support, since a sheared top carries nothing and stands
 * on the plate. Same-layer footprint overlap and the support's bounds are the
 * footprint check's. `skip` names bins left out, such as the one the candidate
 * replaces.
 */
export function slantConflicts(
  candidate: Bin,
  own: PlacedSlant | null,
  layout: SlantLayout & Pick<Layout, 'bins'>,
  skip: (other: Bin) => boolean = () => false
): SlantConflict[] {
  const conflicts: SlantConflict[] = [];
  const ownSupport = own?.support ? [own.support] : [];
  const ownZone = [candidate, ...ownSupport];
  for (const other of layout.bins) {
    if (other.layerId === STAGING_ID || other.id === candidate.id || skip(other)) continue;
    const zone = slantZone(other, layout);
    if (other.layerId === candidate.layerId) {
      const theirSupport = zone.rects.slice(1);
      if (
        overlapsAny(ownSupport, [other, ...theirSupport]) ||
        overlapsAny([candidate], theirSupport)
      ) {
        conflicts.push({ kind: 'collision', with: other });
      }
    } else if ((own !== null || zone.slanted) && overlapsAny(ownZone, zone.rects)) {
      conflicts.push({ kind: 'stacked', with: other });
    }
  }
  return conflicts;
}
