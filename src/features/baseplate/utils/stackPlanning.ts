/** Physical stack planning for one split baseplate. */
import { STACK_PRINT_MAX_STACK_HEIGHT } from '@/core/types';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { BaseplateTiling } from '../types/tiling';
import { groupPiecesByFingerprint } from './pieceFingerprint';
import { assignGroupNames } from './pieceNaming';
import {
  canMixPiece,
  pieceFootprint,
  printedFootprint,
  footprintFits,
  translateFootprint,
  type Footprint,
} from './stackFootprint';
import type { PlateFlipAxis } from './stackPrint';

/** One unique-piece group needing `quantity` copies for a single complete set. */
export interface StackGroup {
  readonly label: string;
  readonly quantity: number;
}

/** One physical print job: a single piece repeated `copies` times in a tower. */
export interface PhysicalStack {
  readonly label: string;
  readonly copies: number;
  /** Present for mixed-size mode; ordered from the print bed upwards. */
  readonly layers?: readonly StackLayer[];
}

export interface StackLayer {
  /** Representative tiling piece whose generated mesh is used. */
  readonly sourceLabel: string;
  /** Actual piece of the drawer represented by this layer. */
  readonly pieceLabel: string;
  readonly groupName: string;
  readonly dxMm: number;
  readonly dyMm: number;
  /** In-plane turn before the upper layer is flipped for printing. */
  readonly rotationDeg?: 90 | 180 | 270;
  readonly flipAxis?: PlateFlipAxis;
}

/** Plan all tiles of one split layout, nesting smaller grid-aligned tiles above larger ones. */
export function planMixedPieceStacks(
  tiling: BaseplateTiling,
  params: ResolvedBaseplateParams,
  copies: number,
  maxStackHeight: number
): PhysicalStack[] {
  const cap = Number.isFinite(maxStackHeight) ? Math.max(1, Math.floor(maxStackHeight)) : 1;
  const multiplier = Math.max(1, Math.floor(copies));
  const groups = groupPiecesByFingerprint(tiling.pieces, params);
  const names = assignGroupNames(groups, tiling.pieces);
  const eligible: {
    name: string;
    source: string;
    pieceLabel: string;
    width: number;
    depth: number;
    footprint: Footprint;
  }[] = [];
  const uniform: PhysicalStack[] = [];
  for (const [fingerprint, group] of groups) {
    const name = names.get(fingerprint) ?? 'piece';
    const source = tiling.pieces[group.indices[0]].label;
    const width = group.params.width * group.params.gridUnitMm;
    const depth = group.params.depth * (group.params.gridUnitMmY ?? group.params.gridUnitMm);
    const pieceLabels = group.indices.map((index) => tiling.pieces[index].label);
    const count = pieceLabels.length * multiplier;
    if (canMixPiece(group.params)) {
      const footprint = pieceFootprint(group.params);
      for (let copy = 0; copy < multiplier; copy++) {
        for (const pieceLabel of pieceLabels) {
          eligible.push({ name, source, pieceLabel, width, depth, footprint });
        }
      }
    } else {
      const sameSizeTowers = planPhysicalStacks([{ label: name, quantity: count }], cap);
      for (const [index, tower] of sameSizeTowers.entries()) {
        uniform.push({
          ...tower,
          label: sameSizeTowers.length > 1 ? `${name}_${index + 1}` : name,
          layers: Array.from({ length: tower.copies }, (_, layerIndex) => ({
            sourceLabel: source,
            pieceLabel: pieceLabels[(index * cap + layerIndex) % pieceLabels.length],
            groupName: name,
            dxMm: 0,
            dyMm: 0,
          })),
        });
      }
    }
  }

  eligible.sort(
    (a, b) =>
      b.width * b.depth - a.width * a.depth ||
      (b.footprint.maxX - b.footprint.minX) * (b.footprint.maxY - b.footprint.minY) -
        (a.footprint.maxX - a.footprint.minX) * (a.footprint.maxY - a.footprint.minY) ||
      b.width - a.width ||
      b.depth - a.depth
  );
  const towers: {
    width: number;
    depth: number;
    topWidth: number;
    topDepth: number;
    topFootprint: Footprint;
    layers: StackLayer[];
  }[] = [];
  for (const piece of eligible) {
    // Match grid posts, then check the whole printed footprint, including
    // padding and connector tongues. Both flip axes and corner alignments are
    // considered because these four distinct drawer tiles can mirror each other.
    let best = -1;
    let placement:
      | {
          rotationDeg: 0 | 90 | 180 | 270;
          flipAxis: PlateFlipAxis;
          dx: number;
          dy: number;
          bounds: Footprint;
          width: number;
          depth: number;
        }
      | undefined;
    for (let j = 0; j < towers.length; j++) {
      const tower = towers[j];
      if (tower.layers.length >= cap) continue;
      const rotations: readonly (0 | 90 | 180 | 270)[] =
        params.gridUnitMm === (params.gridUnitMmY ?? params.gridUnitMm)
          ? [0, 90, 180, 270]
          : [0, 180];
      for (const rotationDeg of rotations) {
        const odd = rotationDeg === 90 || rotationDeg === 270;
        const width = odd ? piece.depth : piece.width;
        const depth = odd ? piece.width : piece.depth;
        if (width > tower.topWidth + 1e-6 || depth > tower.topDepth + 1e-6) continue;
        const dxChoices = [(width - tower.width) / 2, (tower.width - width) / 2];
        const dyChoices = [(depth - tower.depth) / 2, (tower.depth - depth) / 2];
        for (const flipAxis of ['x', 'y'] as const) {
          const bounds = printedFootprint(piece.footprint, rotationDeg, flipAxis);
          for (const dx of dxChoices) {
            for (const dy of dyChoices) {
              if (!footprintFits(bounds, tower.topFootprint, dx, dy)) continue;
              if (best < 0 || tower.layers.length > towers[best].layers.length) {
                best = j;
                placement = { rotationDeg, flipAxis, dx, dy, bounds, width, depth };
              }
              break;
            }
            if (best === j) break;
          }
          if (best === j) break;
        }
        if (best === j) break;
      }
    }
    if (best < 0 || !placement) {
      towers.push({
        width: piece.width,
        depth: piece.depth,
        topWidth: piece.width,
        topDepth: piece.depth,
        topFootprint: piece.footprint,
        layers: [
          {
            sourceLabel: piece.source,
            pieceLabel: piece.pieceLabel,
            groupName: piece.name,
            dxMm: 0,
            dyMm: 0,
          },
        ],
      });
    } else {
      const tower = towers[best];
      tower.layers.push({
        sourceLabel: piece.source,
        pieceLabel: piece.pieceLabel,
        groupName: piece.name,
        dxMm: placement.dx,
        dyMm: placement.dy,
        ...(placement.rotationDeg ? { rotationDeg: placement.rotationDeg } : {}),
        flipAxis: placement.flipAxis,
      });
      tower.topWidth = placement.width;
      tower.topDepth = placement.depth;
      tower.topFootprint = translateFootprint(placement.bounds, placement.dx, placement.dy);
    }
  }
  return [
    ...towers.map((tower, i) => ({
      label: `stack-${i + 1}`,
      copies: tower.layers.length,
      layers: tower.layers,
    })),
    ...uniform,
  ];
}

/** Resolve the active plan while leaving the original identical-only path intact. */
export function planStackPrint(
  tiling: BaseplateTiling | null,
  params: ResolvedBaseplateParams,
  copies: number,
  maxStackHeight: number,
  mixedSizes: boolean
): PhysicalStack[] {
  if (mixedSizes && tiling?.isSplit) {
    return planMixedPieceStacks(tiling, params, copies, maxStackHeight);
  }
  return planPhysicalStacks(stackGroupsFromTiling(tiling, params, copies), maxStackHeight);
}

/**
 * Plan the physical stacks for a drawer. Each group needs `quantity` copies; a
 * group taller than `maxStackHeight` is split across several stacks (e.g. 18
 * copies, cap 8 -> 8 + 8 + 2). Groups/quantities at or below zero are skipped.
 * Returns one entry per physical tower to print.
 */
export function planPhysicalStacks(
  groups: readonly StackGroup[],
  maxStackHeight: number = STACK_PRINT_MAX_STACK_HEIGHT
): PhysicalStack[] {
  const cap = Number.isFinite(maxStackHeight) ? Math.max(1, Math.floor(maxStackHeight)) : 1;
  const stacks: PhysicalStack[] = [];

  for (const group of groups) {
    let remaining = Math.max(0, Math.floor(group.quantity));
    while (remaining > 0) {
      const copies = Math.min(cap, remaining);
      stacks.push({ label: group.label, copies });
      remaining -= copies;
    }
  }

  return stacks;
}

/**
 * Whether a physical-stack plan maps 1:1 onto the tiling's split pieces: every
 * tower is a single plate (`copies === 1`) carrying a distinct piece label. Only
 * then do towers correspond to spatial piece positions (the "no stacks" preview
 * layout). A deduped or height-capped plan fails this: `cap === 1` expands a
 * quantity-N group into N same-label single-plate stacks, which satisfies the
 * count/copies tests but repeats a label. Mixed towers carry each real piece's
 * grid label separately from the deduplicated source mesh, so use that label
 * when restoring their assembled positions.
 */
export function isUnstackedSplit(plan: readonly PhysicalStack[], pieceCount: number): boolean {
  if (plan.length !== pieceCount) return false;
  if (!plan.every((s) => s.copies === 1)) return false;
  return new Set(plan.map((s) => s.layers?.[0]?.pieceLabel ?? s.label)).size === plan.length;
}

/**
 * Derive the identical-piece groups a drawer needs. For a single (unsplit)
 * plate that's one group of quantity 1; for a split plate each fingerprint
 * group contributes its piece count, labelled by its first piece (e.g. "A1").
 *
 * `copies` duplicates the whole layout: every group's quantity is multiplied by
 * it, so a single-plate layout with copies=3 becomes one group of quantity 3.
 */
export function stackGroupsFromTiling(
  tiling: BaseplateTiling | null,
  params: ResolvedBaseplateParams,
  copies = 1
): StackGroup[] {
  const n = Math.max(1, Math.floor(copies));
  if (!tiling || !tiling.isSplit) return [{ label: 'plate', quantity: n }];
  const groups = groupPiecesByFingerprint(tiling.pieces, params);
  const result: StackGroup[] = [];
  for (const group of groups.values()) {
    const label = tiling.pieces[group.indices[0]]?.label ?? 'piece';
    result.push({ label, quantity: group.indices.length * n });
  }
  return result;
}
