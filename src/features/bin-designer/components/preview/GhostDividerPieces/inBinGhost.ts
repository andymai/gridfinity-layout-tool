import * as THREE from 'three';
import type { BinParams, WallCutoutShape } from '@/shared/types/bin';
import {
  calculateDividerLength,
  calculateSlotPositions,
  getEffectiveSlotDimensions,
  getReceptacleDepth,
  resolveCrossDividerMode,
  tabEngagement,
} from '@/shared/utils/slotMath';
import { pieceCorners } from '@/shared/utils/slottedFillet';
import type { DividerFilletSeat, PieceCorners } from '@/shared/utils/slottedFillet';
import { referencePieceGeometry } from './referencePieceOutline';

/**
 * Split a span into the gaps left between crossing dividers, each `gapWidth`
 * wide. Returns the center and length of every positive-length gap (from the
 * span edge to the first divider, between dividers, and to the far edge).
 */
export function slotSegments(
  positions: number[],
  span: number,
  gapWidth: number
): { center: number; len: number }[] {
  const sorted = [...positions].sort((a, b) => a - b);
  const edges = [
    -span / 2,
    ...sorted.flatMap((p) => [p - gapWidth / 2, p + gapWidth / 2]),
    span / 2,
  ];
  const segments: { center: number; len: number }[] = [];
  for (let i = 0; i < edges.length; i += 2) {
    const len = edges[i + 1] - edges[i];
    if (len > 0) segments.push({ center: (edges[i] + edges[i + 1]) / 2, len });
  }
  return segments;
}

export interface GhostBox {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly matrix: THREE.Matrix4;
  /** A piece outline to place instead of the plain `w`×`d`×`h` box. */
  readonly shape?: THREE.BufferGeometry;
}

/** Merge placed boxes into one BufferGeometry, remapping vertex indices. */
export function mergeBoxes(boxes: GhostBox[], computeNormals: boolean): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const vec = new THREE.Vector3();

  for (const { w, d, h, matrix, shape } of boxes) {
    const part = shape ?? new THREE.BoxGeometry(w, d, h);
    const pos = part.getAttribute('position');
    const index = part.getIndex();
    const offset = positions.length / 3;
    for (let v = 0; v < pos.count; v++) {
      vec.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(matrix);
      positions.push(vec.x, vec.y, vec.z);
    }
    if (index) {
      for (let j = 0; j < index.count; j++) indices.push(index.array[j] + offset);
    } else {
      for (let v = 0; v < pos.count; v++) indices.push(offset + v);
    }
    part.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  if (computeNormals) merged.computeVertexNormals();
  return merged;
}

export interface InBinGhostInput {
  readonly slotConfig: BinParams['slotConfig'];
  readonly dividerPieces: BinParams['dividerPieces'];
  readonly dividerHeight: number;
  readonly wallThickness: number;
  readonly innerW: number;
  readonly innerD: number;
  /** Shift of the cavity centre off scene origin, from an asymmetric overhang. */
  readonly offsetX: number;
  readonly offsetY: number;
  /** Where the pieces stand, in the scene frame. */
  readonly floorZ: number;
  readonly lipOverhang: number;
  readonly filletSeat: DividerFilletSeat | null;
  readonly shape: WallCutoutShape;
}

/** The in-bin ghosts: one translucent box or outline at every divider position. */
export function inBinGhostGeometry(input: InBinGhostInput): THREE.BufferGeometry | null {
  const { slotConfig, dividerPieces, dividerHeight, innerW, innerD, filletSeat } = input;
  const { thickness, clearance } = dividerPieces;
  const crossMode = resolveCrossDividerMode(slotConfig, thickness);
  const { slotDepth } = getEffectiveSlotDimensions(input.wallThickness, thickness, clearance);
  const boxZ = input.floorZ + dividerHeight / 2;
  // Slot positions are relative to the cavity center; an asymmetric overhang
  // moves that center off scene origin, which stays the nominal footprint's.
  const at = (x: number, y: number): THREE.Matrix4 =>
    new THREE.Matrix4().makeTranslation(x + input.offsetX, y + input.offsetY, boxZ);
  // A piece outline is drawn along X; one running along Y is turned onto it.
  const alongY = (x: number, y: number): THREE.Matrix4 =>
    at(x, y).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  const rounded = (
    length: number,
    corners: PieceCorners | null
  ): THREE.BufferGeometry | undefined =>
    corners
      ? referencePieceGeometry(length, dividerHeight, thickness, [], null, input.shape, corners)
      : undefined;
  const bothEnds = pieceCorners(filletSeat, true, true);
  // A wall-end segment reaches into its slot by the edge piece's tab, as the
  // printed piece does, so its rounded corner lands where the piece's does.
  const edgeTab = Math.min(
    tabEngagement(slotDepth, clearance),
    tabEngagement(getReceptacleDepth(thickness), clearance)
  );
  const segmentBox = (
    seg: { center: number; len: number },
    span: number,
    along: 'x' | 'y',
    cross: number
  ): GhostBox => {
    const low = filletSeat !== null && seg.center - seg.len / 2 <= -span / 2 + 1e-6;
    const high = filletSeat !== null && seg.center + seg.len / 2 >= span / 2 - 1e-6;
    const len = seg.len + (low ? edgeTab : 0) + (high ? edgeTab : 0);
    const center = seg.center + ((high ? edgeTab : 0) - (low ? edgeTab : 0)) / 2;
    const shape = rounded(len, pieceCorners(filletSeat, low, high));
    return along === 'x'
      ? { w: len, d: thickness, h: dividerHeight, matrix: at(center, cross), shape }
      : {
          w: thickness,
          d: len,
          h: dividerHeight,
          matrix: shape ? alongY(cross, center) : at(cross, center),
          shape,
        };
  };

  const boxes: GhostBox[] = [];

  // In insert mode the short-axis ghosts are segmented per compartment:
  // one box per gap between long dividers (and between wall and divider).
  // Sub-0.5mm slivers are dropped.
  const compartmentSegments = (
    longPositions: number[],
    innerDim: number
  ): { center: number; len: number }[] =>
    slotSegments(longPositions, innerDim, thickness).filter((s) => s.len > 0.5);

  const xPositions = slotConfig.y.enabled
    ? calculateSlotPositions(innerW, slotConfig.y.pitch, input.lipOverhang)
    : [];
  const yPositions = slotConfig.x.enabled
    ? calculateSlotPositions(innerD, slotConfig.x.pitch, input.lipOverhang)
    : [];
  const insertActive =
    slotConfig.x.enabled &&
    slotConfig.y.enabled &&
    crossMode.style === 'insert' &&
    (crossMode.longAxis === 'y' ? xPositions : yPositions).length > 0;

  // X-axis dividers: span width (X), positioned along depth (Y)
  if (slotConfig.x.enabled) {
    const divLength = calculateDividerLength(innerW, slotDepth, clearance);
    const segmented = insertActive && crossMode.longAxis === 'y';

    for (const yPos of yPositions) {
      if (segmented) {
        for (const seg of compartmentSegments(xPositions, innerW)) {
          boxes.push(segmentBox(seg, innerW, 'x', yPos));
        }
      } else {
        boxes.push({
          w: divLength,
          d: thickness,
          h: dividerHeight,
          matrix: at(0, yPos),
          shape: rounded(divLength, bothEnds),
        });
      }
    }
  }

  // Y-axis dividers: span depth (Y), positioned along width (X)
  if (slotConfig.y.enabled) {
    const divLength = calculateDividerLength(innerD, slotDepth, clearance);
    const segmented = insertActive && crossMode.longAxis === 'x';

    for (const xPos of xPositions) {
      if (segmented) {
        for (const seg of compartmentSegments(yPositions, innerD)) {
          boxes.push(segmentBox(seg, innerD, 'y', xPos));
        }
      } else {
        const shape = rounded(divLength, bothEnds);
        boxes.push({
          w: thickness,
          d: divLength,
          h: dividerHeight,
          matrix: shape ? alongY(xPos, 0) : at(xPos, 0),
          shape,
        });
      }
    }
  }

  if (boxes.length === 0) return null;

  return mergeBoxes(boxes, false);
}
