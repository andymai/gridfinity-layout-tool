import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import type { CutoutDepthFrame } from '@/shared/utils/cutoutDepth';
import type { PreviewMap } from '../cutoutInteractionTypes';
import { placeLeanOpenings } from '../leanOpening';
import { LEAN_OPENING_COLOR, RENDER_ORDER } from './constants';

interface LeanOpenings3DProps {
  readonly cutouts: readonly Cutout[];
  readonly preview: PreviewMap;
  readonly frame: CutoutDepthFrame;
}

export function LeanOpenings3D({ cutouts, preview, frame }: LeanOpenings3DProps) {
  const openings = useMemo(
    () => placeLeanOpenings(cutouts, preview, frame),
    [cutouts, preview, frame]
  );
  return (
    <>
      {openings.map((o) => (
        <OpeningOutline key={`lean-${o.key}`} ring={o.ring} />
      ))}
    </>
  );
}

function OpeningOutline({ ring }: { ring: readonly { x: number; y: number }[] }) {
  const line = useMemo(() => {
    const points = [...ring, ring[0]].map((p) => new THREE.Vector3(p.x, p.y, 0.06));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color(LEAN_OPENING_COLOR),
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      dashSize: 1.5,
      gapSize: 1,
    });
    const obj = new THREE.Line(geometry, material);
    // A dashed material draws solid until the line distances exist.
    obj.computeLineDistances();
    obj.renderOrder = RENDER_ORDER.LEAN_OPENING;
    return obj;
  }, [ring]);

  // <primitive> does not dispose what it is handed.
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );

  return <primitive object={line} />;
}
