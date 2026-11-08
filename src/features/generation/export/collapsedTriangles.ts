import type { FaceGroupData } from '../bridge/responses';

const HEADER_BYTES = 80;
const COUNT_BYTES = 4;
const TRIANGLE_BYTES = 50;
const VERTEX_OFFSET = 12;

export interface CollapsedTriangleResult {
  readonly data: ArrayBuffer;
  readonly faceGroups: readonly FaceGroupData[] | undefined;
  readonly dropped: number;
}

/**
 * Drop triangles with two exactly coincident corners from a binary STL.
 *
 * The kernel emits one at each pole of a blend that closes to a point, such as
 * a pocket whose corner radius equals its scoop radius (#4865). It has no area,
 * but its two remaining edges are the same edge run both ways, so a slicer that
 * welds vertices counts that edge as non-manifold. Removing it cannot open a
 * hole: those two edges cancel.
 *
 * `faceGroups` index into this triangle order (in index units, three per
 * triangle), so they are shifted to match; otherwise every 3MF colour after the
 * first dropped triangle lands one face early. An STL with nothing to drop, or
 * with nothing else, is returned as-is, byte for byte.
 */
export function dropCollapsedTriangles(
  stl: ArrayBuffer,
  faceGroups?: readonly FaceGroupData[]
): CollapsedTriangleResult {
  const view = new DataView(stl);
  if (stl.byteLength < HEADER_BYTES + COUNT_BYTES) return { data: stl, faceGroups, dropped: 0 };
  const count = view.getUint32(HEADER_BYTES, true);
  if (stl.byteLength < HEADER_BYTES + COUNT_BYTES + count * TRIANGLE_BYTES) {
    return { data: stl, faceGroups, dropped: 0 };
  }

  const droppedBefore = new Uint32Array(count + 1);
  let dropped = 0;
  for (let t = 0; t < count; t++) {
    droppedBefore[t] = dropped;
    if (isCollapsed(view, HEADER_BYTES + COUNT_BYTES + t * TRIANGLE_BYTES)) dropped++;
  }
  droppedBefore[count] = dropped;
  // A mesh that is nothing but slivers is left as it was rather than written
  // out empty, which would get past the empty-mesh check that ran before this.
  if (dropped === 0 || dropped === count) return { data: stl, faceGroups, dropped: 0 };

  const kept = count - dropped;
  const out = new Uint8Array(HEADER_BYTES + COUNT_BYTES + kept * TRIANGLE_BYTES);
  const src = new Uint8Array(stl);
  out.set(src.subarray(0, HEADER_BYTES));
  new DataView(out.buffer).setUint32(HEADER_BYTES, kept, true);
  let write = HEADER_BYTES + COUNT_BYTES;
  for (let t = 0; t < count; t++) {
    if (droppedBefore[t + 1] !== droppedBefore[t]) continue;
    const read = HEADER_BYTES + COUNT_BYTES + t * TRIANGLE_BYTES;
    out.set(src.subarray(read, read + TRIANGLE_BYTES), write);
    write += TRIANGLE_BYTES;
  }

  return { data: out.buffer, faceGroups: remapFaceGroups(faceGroups, droppedBefore), dropped };
}

function isCollapsed(view: DataView, triangleOffset: number): boolean {
  const corner = (k: number, axis: number): number =>
    view.getFloat32(triangleOffset + VERTEX_OFFSET + k * 12 + axis * 4, true);
  const same = (a: number, b: number): boolean =>
    corner(a, 0) === corner(b, 0) && corner(a, 1) === corner(b, 1) && corner(a, 2) === corner(b, 2);
  return same(0, 1) || same(1, 2) || same(0, 2);
}

function remapFaceGroups(
  faceGroups: readonly FaceGroupData[] | undefined,
  droppedBefore: Uint32Array
): readonly FaceGroupData[] | undefined {
  if (!faceGroups) return undefined;
  const last = droppedBefore.length - 1;
  const at = (triangle: number): number => droppedBefore[Math.min(Math.max(triangle, 0), last)];
  return faceGroups
    .map((group) => {
      const first = Math.floor(group.start / 3);
      const end = first + Math.floor(group.count / 3);
      return {
        ...group,
        start: (first - at(first)) * 3,
        count: (end - first - (at(end) - at(first))) * 3,
      };
    })
    .filter((group) => group.count > 0);
}
