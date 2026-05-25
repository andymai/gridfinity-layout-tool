/**
 * BREP-level boolean combination of grouped cutout solids by Pathfinder op.
 *
 * Each member shape has already been built and positioned by `cutoutBuilder`;
 * this module just runs the Union/Subtract/Intersect/Exclude boolean and
 * returns a single fused solid (or `null` if the result is empty).
 *
 * Memory rules:
 *  - Callers retain ownership of every member in `members` and must dispose
 *    them after this call (we only ever consume clones).
 *  - The returned solid is a fresh allocation that the caller must dispose.
 */

import { cut, fuseAll, intersect, clone, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { Cutout, GroupOp } from '@/shared/types/bin';

export function combineGroupSolids(
  members: readonly Shape3D[],
  membersByMember: readonly Cutout[],
  op: GroupOp
): Shape3D | null {
  if (members.length === 0) return null;
  if (members.length === 1) return unwrap(clone(members[0]));

  const cloneOne = (s: Shape3D): Shape3D => unwrap(clone(s));
  const fuseClones = (xs: readonly Shape3D[]): Shape3D => {
    const copies = xs.map(cloneOne);
    const fused = unwrap(fuseAll(copies as ValidSolid[]));
    for (const c of copies) c.delete();
    return fused;
  };

  switch (op) {
    case 'union':
      return fuseClones(members);

    case 'subtract': {
      // Front (top z-index) carves the union of the rest. Stable tiebreak on
      // array order matches the cutout list ordering, which is the visual
      // back-to-front order used elsewhere.
      const indexed = members.map((shape, i) => ({ shape, cutout: membersByMember[i], i }));
      indexed.sort((a, b) => {
        const za = a.cutout.zIndex ?? 0;
        const zb = b.cutout.zIndex ?? 0;
        if (za !== zb) return zb - za;
        return b.i - a.i;
      });
      const top = indexed[0];
      const baseMembers = indexed.slice(1).map((e) => e.shape);
      const base = baseMembers.length === 1 ? cloneOne(baseMembers[0]) : fuseClones(baseMembers);
      const topClone = cloneOne(top.shape);
      try {
        return unwrap(cut(base, topClone));
      } catch {
        return null;
      } finally {
        base.delete();
        topClone.delete();
      }
    }

    case 'intersect': {
      // Reduce intersect across all members. Each step consumes its inputs;
      // bail to null the first time the running intersection comes out empty
      // so callers don't render a phantom cut.
      let acc: Shape3D = cloneOne(members[0]);
      for (let i = 1; i < members.length; i++) {
        const next = cloneOne(members[i]);
        try {
          const result = unwrap(intersect(acc, next));
          acc.delete();
          next.delete();
          acc = result;
        } catch {
          acc.delete();
          next.delete();
          return null;
        }
      }
      return acc;
    }

    case 'exclude': {
      // XOR: union − intersection. Two parallel fuseAll/intersect reductions;
      // intersection-empty short-circuits to union (acts like Union when
      // members are disjoint, matching Illustrator's Exclude).
      const unionShape = fuseClones(members);
      let intersectionShape: Shape3D = cloneOne(members[0]);
      let intersectionLive = true;
      for (let i = 1; i < members.length && intersectionLive; i++) {
        const next = cloneOne(members[i]);
        try {
          const result = unwrap(intersect(intersectionShape, next));
          intersectionShape.delete();
          next.delete();
          intersectionShape = result;
        } catch {
          intersectionShape.delete();
          next.delete();
          intersectionLive = false;
        }
      }
      if (!intersectionLive) return unionShape;
      try {
        return unwrap(cut(unionShape, intersectionShape));
      } catch {
        return null;
      } finally {
        unionShape.delete();
        intersectionShape.delete();
      }
    }
  }
}
