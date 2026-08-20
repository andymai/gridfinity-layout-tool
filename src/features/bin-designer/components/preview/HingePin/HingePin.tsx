/**
 * The filament pin, drawn on the hinge axis.
 *
 * Hardware the user supplies, so it is rendered in a flat neutral grey rather
 * than the design's own colour — it should read as the offcut it is and not as
 * something the printer will produce. Without it the interleaved knuckles are
 * two rows of half-cylinders with a gap down the middle, and what they are for
 * is not obvious; with it, the joint explains itself.
 *
 * Deliberately OUTSIDE the lid's rotating group: the pin stays on the axis at
 * every opening angle. Putting it in the group would carry it round with the
 * lid, which is exactly the thing a hinge does not do.
 *
 * One rod per RUN, because a cutout that splits the hinge wall leaves two
 * barrels that take two pins — the same statement the panel and the export
 * dialog make about lengths.
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { hingePinSegments } from '../LidMesh/lidAnchorZ';

/** Neutral hardware grey — not a filament colour, on purpose. */
const PIN_COLOR = '#8a8f98';

export function HingePin({ visible = true }: { visible?: boolean }) {
  const { invalidate } = useThree();
  const params = useDesignerStore((s) => s.params);

  const segments = useMemo(() => hingePinSegments(params), [params]);

  useEffect(() => {
    invalidate();
  }, [segments, visible, invalidate]);

  if (!visible || segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) => (
        <mesh
          key={i}
          position={[seg.centre[0], seg.centre[1], seg.centre[2]]}
          // A cylinder is built along its own Y and this scene is Z-up, so a
          // pin on the Y axis needs no turn at all and one on the X axis needs
          // a quarter turn about Z. The identity case is the one worth stating:
          // reaching for a rotation on both branches is how it ends up laid
          // along Z, standing the pin on end through the bin.
          rotation={seg.alongX ? [0, 0, Math.PI / 2] : [0, 0, 0]}
        >
          <cylinderGeometry args={[seg.radiusMm, seg.radiusMm, seg.lengthMm, 12]} />
          <meshStandardMaterial color={PIN_COLOR} roughness={0.35} metalness={0.1} />
        </mesh>
      ))}
    </>
  );
}
